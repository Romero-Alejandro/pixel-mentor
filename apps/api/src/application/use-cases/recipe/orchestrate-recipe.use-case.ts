import { randomUUID } from 'node:crypto';

import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { SessionNotFoundError } from '@/domain/ports/session-repository.js';
import type { InteractionRepository } from '@/domain/ports/interaction-repository.js';
import type { RecipeRepository } from '@/domain/ports/recipe-repository.js';
import { RecipeNotFoundError } from '@/domain/ports/recipe-repository.js';
import type { ConceptRepository } from '@/domain/ports/concept-repository.js';
import type { ActivityRepository } from '@/domain/ports/activity-repository.js';
import type { AtomRepository } from '@/domain/ports/atom-repository.js';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import type { AdvisoryLockManager } from '@/domain/ports/advisory-lock.js';
import { createSessionLockId } from '@/domain/ports/advisory-lock.js';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state.js';
import type { Interaction } from '@/domain/entities/interaction.js';
import type { SessionCheckpoint } from '@/domain/entities/session.js';
import type {
  InteractRecipeOutput,
  StaticContent,
  InteractionChunk,
} from '@/application/dto/index.js';
import { determineClassificationAction } from '@/domain/entities/question-classification.js';
import { ContextWindowService } from '@/application/services/context-window.service.js';
import {
  parseRecipeConfig,
  fillTemplate,
  DEFAULT_CONFIG,
  type RecipeConfig,
} from '@/domain/entities/recipe-config.js';
import { isTerminalStatus } from '@/domain/entities/session.js';
import { DEFAULT_COHORT as USER_DEFAULT_COHORT } from '@/domain/entities/user.js';
import type {
  LessonEvaluatorUseCase,
  EvaluationRequest,
  EvaluationResult,
} from '@/evaluator/index.js';
import type { FeatureFlagService } from '@/config/evaluation-flags.js';

// Gamification imports
import { getEventBus } from '@/events/event-bus.js';
import { GameDomainEvents } from '@/events/game-events.js';
import type { LessonCompletedPayload } from '@/events/game-events.js';

// Metrics imports
import {
  EvaluationMetricsCollector,
  EvaluationTimer,
  type EngineType,
  type EvaluationOutcome,
  type EvaluationErrorType,
} from '@/monitoring/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del script auto-contenido
// ─────────────────────────────────────────────────────────────────────────────

interface ContentScript {
  transition?: string;
  content?: string;
  examples?: string[];
  closure?: string;
}

interface QuestionScript extends ContentScript {
  question: string; // Texto de la pregunta de comprensión
  expectedAnswer: string; // Respuesta esperada (para el evaluador LLM)
  hint?: string;
  feedback: { correct: string; incorrect: string };
}

interface ActivityOption {
  text: string;
  isCorrect: boolean;
}

interface ActivityScript extends ContentScript {
  instruction: string; // Enunciado del MCQ
  options: ActivityOption[];
  feedback: { correct: string; incorrect: string };
}

function isQuestionScript(s: unknown): s is QuestionScript {
  return typeof (s as QuestionScript)?.question === 'string';
}

function isActivityScript(s: unknown): s is ActivityScript {
  const opts = (s as ActivityScript)?.options;
  return Array.isArray(opts) && opts.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────

export class OrchestrateRecipeUseCase {
  private config: RecipeConfig = DEFAULT_CONFIG;

  constructor(
    private sessionRepo: SessionRepository,
    private interactionRepo: InteractionRepository,
    private recipeRepo: RecipeRepository,
    private conceptRepo: ConceptRepository,
    private activityRepo: ActivityRepository,
    private atomRepo: AtomRepository,
    private userRepo: UserRepository,
    private aiService: AIService,
    private questionClassifier: QuestionClassifier,
    private ragService: RAGService,
    private comprehensionEvaluator: ComprehensionEvaluator,
    private lessonEvaluator: LessonEvaluatorUseCase,
    private advisoryLockManager?: AdvisoryLockManager,
    private contextWindowService: ContextWindowService = new ContextWindowService(),
    private featureFlagService?: FeatureFlagService,
  ) {
    // Mantenidos para compatibilidad futura
    void this.conceptRepo;
    void this.activityRepo;
  }

  /**
   * Emit LESSON_COMPLETED event to trigger gamification processing (XP, badges, streaks).
   * Wrapped in try/catch so gamification failures never break session completion.
   */
  private async emitLessonCompleted(
    userId: string,
    lessonId: string,
    lessonTitle: string,
  ): Promise<void> {
    try {
      const eventBus = getEventBus();
      const payload: LessonCompletedPayload = {
        userId,
        lessonId,
        lessonTitle,
        completedAt: new Date(),
      };
      await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, payload);
    } catch {
      // Don't fail session completion if gamification fails
    }
  }

  // ─── extractStaticContent ────────────────────────────────────────────────
  /**
   * Lee TODO el contenido del paso desde step.script (JSON auto-contenido).
   *
   * CORRECCIÓN CLAVE respecto a la versión anterior:
   *   - La versión anterior leía `step.activityId` → siempre undefined porque
   *     el campo no existe en el schema de Prisma.
   *   - Ahora leemos directamente de `step.script.options` / `step.script.question`,
   *     que están embebidos en el JSON del paso. Sin dependencias de FKs externas.
   */
  private extractStaticContent(step: {
    stepType?: string | null;
    script?: unknown;
  }): StaticContent | undefined {
    const { stepType, script } = step;
    if (!stepType || !script) return undefined;

    // ── Contenido / intro / closure ──────────────────────────────────────
    if (stepType === 'content' || stepType === 'intro' || stepType === 'closure') {
      const s = script as ContentScript;
      return {
        stepType: stepType as 'content' | 'intro' | 'closure',
        script: {
          transition: s.transition ?? '',
          content: s.content ?? '',
          examples: s.examples ?? [],
          closure: s.closure ?? '',
        },
      };
    }

    // ── Pregunta de comprensión (respuesta libre) ─────────────────────────
    if (stepType === 'question' && isQuestionScript(script)) {
      return {
        stepType: 'activity', // La UI lo trata como panel interactivo
        script: {
          transition: script.transition ?? '',
          content: script.question,
          examples: [],
          closure: '',
        },
        activity: {
          instruction: script.question,
          options: [], // Sin opciones = input libre en el frontend
          feedback: {
            correct: script.feedback.correct,
            incorrect: script.feedback.incorrect,
            partial: script.hint,
          },
        },
      };
    }

    // ── Actividad / examen (opción múltiple) ──────────────────────────────
    if ((stepType === 'activity' || stepType === 'exam') && isActivityScript(script)) {
      return {
        stepType: 'activity',
        script: {
          transition: script.transition ?? '',
          content: script.instruction,
          examples: [],
          closure: script.closure ?? '',
        },
        activity: {
          instruction: script.instruction,
          options: script.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          feedback: {
            correct: script.feedback.correct,
            incorrect: script.feedback.incorrect,
          },
        },
      };
    }

    // Fallback
    const s = script as ContentScript;
    return {
      stepType: 'content',
      script: {
        transition: s.transition ?? '',
        content: s.content ?? '',
        examples: s.examples ?? [],
        closure: s.closure ?? '',
      },
    };
  }

  // ─── buildVoiceText ──────────────────────────────────────────────────────
  private buildVoiceText(step: { stepType?: string | null; script?: unknown }): string {
    const { stepType, script } = step;
    if (!script) return '';

    if (stepType === 'question' && isQuestionScript(script)) {
      return [script.transition, script.question].filter(Boolean).join(' ');
    }
    if ((stepType === 'activity' || stepType === 'exam') && isActivityScript(script)) {
      return [script.transition, script.instruction].filter(Boolean).join(' ');
    }
    const s = script as ContentScript;
    return [s.transition, s.content, s.closure].filter(Boolean).join(' ');
  }

  // ─── Helpers de clasificación de paso ───────────────────────────────────

  private requiresStudentInput(stepType?: string | null): boolean {
    return stepType === 'activity' || stepType === 'exam' || stepType === 'question';
  }

  private stateForStep(step: { stepType?: string | null }): PedagogicalState {
    return this.requiresStudentInput(step?.stepType) ? 'ACTIVITY_WAIT' : 'EXPLANATION';
  }

  private advanceStep(steps: any[], current: number): number | null {
    const next = current + 1;
    return next < steps.length ? next : null;
  }

  private findPreviousContentStep(steps: any[], from: number): number | null {
    for (let i = from - 1; i >= 0; i--) {
      if (!this.requiresStudentInput(steps[i].stepType)) return i;
    }
    return null;
  }

  private getFallbackResponse(state: PedagogicalState, title: string): AIResponse {
    return {
      explanation: `Continuemos con ${title}.`,
      supportQuotes: [],
      pedagogicalState: state,
    };
  }

  private async record(sessionId: string, turnBase: number, text: string, type: string | null) {
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: turnBase + 1,
      transcript: text,
      aiResponse: type ? { text, responseType: type } : null,
      pausedForQuestion: false,
    });
  }

  // ─── evaluateWithLessonEngine ───────────────────────────────────────────
  /**
   * Evaluates a student's answer using the new LessonEvaluatorUseCase engine.
   *
   * Maps the existing script data to the new EvaluationRequest DTO:
   * - TeacherConfig: centralTruth from expectedAnswer, empty keywords (future extraction possible)
   * - LessonContext: built from recipe metadata
   * - EvaluationRequest: studentAnswer = studentInput
   */
  private async evaluateWithLessonEngine(params: {
    script: QuestionScript;
    studentInput: string;
    attemptNumber: number;
    recipeTitle: string;
    stepIndex: number;
  }): Promise<ComprehensionEvaluation> {
    // attemptNumber reserved for future use (adaptive hints based on attempts)
    void params.attemptNumber;
    const { script, studentInput, recipeTitle } = params;

    // Build TeacherConfig from script
    const teacherConfig = {
      centralTruth: script.expectedAnswer ?? '',
      requiredKeywords: [] as string[], // Could extract from expectedAnswer in future
      maxScore: 10,
    };

    // Build LessonContext from recipe metadata
    // Note: For more accurate context, we could extract subject/gradeLevel from recipe.meta
    const lessonContext = {
      subject: 'Educación General', // Could be extracted from recipe metadata
      gradeLevel: 'Nivel General', // Could be extracted from recipe metadata
      topic: recipeTitle,
    };

    // Build EvaluationRequest
    const request: EvaluationRequest = {
      studentAnswer: studentInput,
      questionText: script.question,
      teacherConfig,
      lessonContext,
    };

    try {
      const result: EvaluationResult = await this.lessonEvaluator.evaluate(request);

      // Map EvaluationResult to ComprehensionEvaluation
      return {
        result: result.outcome,
        confidence: result.confidence,
        hint: result.improvementSuggestion,
        shouldEscalate: false,
      };
    } catch (error) {
      // Graceful fallback to incorrect on error
      console.error('[OrchestrateRecipe] LessonEvaluator error:', error);
      return {
        result: 'incorrect',
        confidence: 0,
        hint: script.hint,
        shouldEscalate: false,
      };
    }
  }

  // ─── evaluateWithLegacyEngine ───────────────────────────────────────────
  /**
   * Evaluates using the legacy ComprehensionEvaluator adapter.
   * Maintains backward compatibility with existing implementations.
   */
  private async evaluateWithLegacyEngine(params: {
    script: QuestionScript;
    studentInput: string;
    attemptNumber: number;
  }): Promise<ComprehensionEvaluation> {
    const { script, studentInput, attemptNumber } = params;

    return this.comprehensionEvaluator.evaluate({
      microQuestion: script.question,
      expectedAnswer: script.expectedAnswer ?? '',
      studentAnswer: studentInput,
      attemptNumber,
    });
  }

  // ─── evaluateAnswer ─────────────────────────────────────────────────────
  /**
   * Unified evaluation method that routes to the appropriate engine based on cohort feature flag.
   * Determines the student's cohort and uses FeatureFlagService to decide which evaluator to use.
   * Integrates with metrics collection for observability.
   */
  private async evaluateAnswer(params: {
    script: QuestionScript;
    studentInput: string;
    attemptNumber: number;
    recipeTitle: string;
    stepIndex: number;
    studentId?: string;
  }): Promise<ComprehensionEvaluation> {
    // Fetch student cohort for feature flag evaluation
    const cohort = await this.getStudentCohort(params.studentId);
    const useNewEngine = this.shouldUseNewEngine(cohort);
    const engineType: EngineType = useNewEngine ? 'new' : 'old';

    // Create metrics collector for this evaluation
    const metrics = new EvaluationMetricsCollector();
    const timer = new EvaluationTimer();
    const completeTracking = metrics.startEvaluation(engineType, cohort);

    // Log which engine is being used for observability
    console.log(
      `[EVAL ENGINE: ${engineType}] cohort=${cohort} requestId=${metrics.getRequestId()}`,
    );

    try {
      let result: ComprehensionEvaluation;

      if (useNewEngine) {
        result = await this.evaluateWithLessonEngine(params);
      } else {
        result = await this.evaluateWithLegacyEngine(params);
      }

      // Record completion metrics
      const latencyMs = timer.getElapsed();
      const outcome = result.result as EvaluationOutcome;
      metrics.recordCompletion(engineType, outcome, latencyMs, cohort);

      console.log(
        `[EVAL COMPLETE] engine=${engineType} outcome=${outcome} latency=${latencyMs}ms cohort=${cohort} requestId=${metrics.getRequestId()}`,
      );

      // Call the tracking completion function
      completeTracking(outcome);

      return result;
    } catch (error) {
      // Record error metrics
      const latencyMs = timer.getElapsed();
      const errorType = this.categorizeError(error);
      metrics.recordError(errorType, error instanceof Error ? error.message : 'Unknown error');

      console.error(
        `[EVAL ERROR] engine=${engineType} error=${errorType} latency=${latencyMs}ms cohort=${cohort} requestId=${metrics.getRequestId()}`,
        error,
      );

      // Call the tracking completion function with error
      completeTracking(
        undefined,
        errorType,
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Return graceful fallback
      return {
        result: 'incorrect',
        confidence: 0,
        hint: params.script.hint,
        shouldEscalate: false,
      };
    }
  }

  /**
   * Categorize an error into a specific error type for metrics
   */
  private categorizeError(error: unknown): EvaluationErrorType {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('timeout')) {
        return 'timeout_error';
      }
      if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('connection')
      ) {
        return 'network_error';
      }
      if (
        message.includes('validation') ||
        message.includes('schema') ||
        message.includes('parse')
      ) {
        return 'validation_error';
      }
      if (
        message.includes('llm') ||
        message.includes('openai') ||
        message.includes('gemini') ||
        message.includes('anthropic')
      ) {
        return 'llm_error';
      }
    }
    return 'unknown_error';
  }

  /**
   * Retrieves the student's cohort from their user profile.
   * Defaults to 'default' cohort if student not found or cohort not set.
   */
  private async getStudentCohort(studentId?: string): Promise<string> {
    if (!studentId) {
      return USER_DEFAULT_COHORT;
    }

    try {
      const student = await this.userRepo.findById(studentId);
      return student?.cohort ?? USER_DEFAULT_COHORT;
    } catch {
      console.warn(
        `[OrchestrateRecipe] Failed to fetch student cohort for ${studentId}, using default`,
      );
      return USER_DEFAULT_COHORT;
    }
  }

  /**
   * Determines if the new evaluation engine should be used based on cohort configuration.
   * Returns false (legacy engine) if FeatureFlagService is not available (backward compatibility).
   */
  private shouldUseNewEngine(cohort: string): boolean {
    if (!this.featureFlagService) {
      // FeatureFlagService not available - default to legacy engine for backward compatibility
      return false;
    }

    try {
      return this.featureFlagService.shouldUseNewEngine(cohort);
    } catch (error) {
      console.error(`[OrchestrateRecipe] FeatureFlagService error for cohort ${cohort}:`, error);
      // Default to legacy engine on error to maintain backward compatibility
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  async start(recipeId: string, studentId: string) {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    this.config = parseRecipeConfig(recipe.meta);
    const student = await this.userRepo.findById(studentId);
    const name = student?.name ?? 'estudiante';

    const steps = await this.recipeRepo.findStepsByRecipeId(recipeId);
    if (!steps.length) throw new Error('Recipe has no steps');

    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);
    if (existing && !isTerminalStatus(existing.status)) {
      const idx = existing.stateCheckpoint.currentStepIndex ?? 0;
      const needsToStart = existing.stateCheckpoint.currentState === 'AWAITING_START';
      const resumeMsg = needsToStart
        ? fillTemplate(this.config.greetings.intro, {
            name,
            tutor: this.config.tutorName,
            title: recipe.title,
          })
        : `¡Bienvenido de vuelta, ${name}! Continuemos con ${recipe.title}.`;
      return {
        sessionId: existing.id,
        voiceText: resumeMsg,
        pedagogicalState: (needsToStart
          ? 'AWAITING_START'
          : existing.stateCheckpoint.currentState) as PedagogicalState,
        staticContent: this.extractStaticContent(steps[idx] ?? steps[0]),
        config: this.config as unknown as Record<string, unknown>,
        resumed: true,
        needsStart: needsToStart,
        lessonProgress: { currentStep: idx, totalSteps: steps.length },
      };
    }

    const sessionId = randomUUID();
    const voiceText = [
      fillTemplate(this.config.greetings.intro, {
        name,
        tutor: this.config.tutorName,
        title: recipe.title,
      }),
      fillTemplate(this.config.greetings.readyPrompt, {
        name,
        tutor: this.config.tutorName,
        title: recipe.title,
      }),
    ].join('. ');

    await this.sessionRepo.create({
      id: sessionId,
      studentId,
      recipeId,
      status: 'IDLE',
      stateCheckpoint: {
        currentState: 'AWAITING_START',
        currentStepIndex: 0,
        questionCount: 0,
        lastQuestionTime: null,
        skippedActivities: [],
        failedAttempts: 0,
      },
    });
    await this.sessionRepo.updateStatus(sessionId, 'ACTIVE');
    await this.record(sessionId, 0, voiceText, 'greeting');

    return {
      sessionId,
      voiceText,
      pedagogicalState: 'AWAITING_START' as PedagogicalState,
      staticContent: this.extractStaticContent(steps[0]),
      config: this.config as unknown as Record<string, unknown>,
      resumed: false,
      needsStart: true,
      lessonProgress: { currentStep: 0, totalSteps: steps.length },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // interact()
  // ─────────────────────────────────────────────────────────────────────────

  async interact(
    sessionId: string,
    studentInput: string,
    userId?: string,
  ): Promise<InteractRecipeOutput> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (userId && session.studentId !== userId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (session.status !== 'ACTIVE') throw new Error(`Session not active: ${session.status}`);

    const recipe = await this.recipeRepo.findById(session.recipeId);
    if (!recipe) throw new RecipeNotFoundError(session.recipeId);
    this.config = parseRecipeConfig(recipe.meta);

    const steps = await this.recipeRepo.findStepsByRecipeId(session.recipeId);
    if (!steps.length) throw new Error('Recipe has no steps');

    const history = await this.interactionRepo.findBySessionOrdered(sessionId);
    const limited = this.contextWindowService.trimHistory(history);
    const recentHistory = limited.map((h: Interaction) => ({
      role: (h.turnNumber % 2 === 1 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.transcript,
    }));
    const historySummary = this.contextWindowService.summarizeOlderTurns(history);

    const cp = session.stateCheckpoint;
    const currentState = cp.currentState as PedagogicalState;
    const currentIdx = cp.currentStepIndex ?? 0;
    let questionCount = cp.questionCount ?? 0;
    let lastQuestionTime = cp.lastQuestionTime ?? null;
    let skippedActivities: string[] = cp.skippedActivities ?? [];
    let failedAttempts = cp.failedAttempts ?? 0;
    let savedStepIndex: number | undefined = cp.savedStepIndex;
    let doubtContext = cp.doubtContext;

    if (session.safetyFlag || session.outOfScope) {
      await this.sessionRepo.escalate(sessionId);
      return {
        voiceText: 'Sesión escalada.',
        pedagogicalState: currentState,
        sessionCompleted: true,
      };
    }

    const currentStep = steps[currentIdx];
    if (!currentStep) {
      await this.sessionRepo.complete(sessionId);
      await this.emitLessonCompleted(session.studentId, session.recipeId, recipe.title);
      return {
        voiceText: fillTemplate(this.config.greetings.completionMessage ?? '¡Felicitaciones!', {
          name: 'estudiante',
          title: recipe.title,
        }),
        pedagogicalState: 'COMPLETED',
        sessionCompleted: true,
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
    }

    const currentAtom = await this.atomRepo.findById(currentStep.atomId);
    if (!currentAtom) throw new Error(`Atom ${currentStep.atomId} not found`);

    // ── AWAITING_START fast path ─────────────────────────────────────────
    if (currentState === 'AWAITING_START') {
      const lower = studentInput.toLowerCase();
      const ready = [
        'sí',
        'si',
        'comenzar',
        'start',
        'listo',
        'adelante',
        'vamos',
        'ready',
        'ok',
        'dale',
        'continuar',
      ].some((w) => lower.includes(w));

      if (ready) {
        const vt = this.buildVoiceText(currentStep);
        await this.record(sessionId, history.length, studentInput, null);
        await this.record(sessionId, history.length + 1, vt, 'answer');
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: this.stateForStep(currentStep),
          currentStepIndex: currentIdx,
        });
        return {
          voiceText: vt,
          pedagogicalState: this.stateForStep(currentStep),
          staticContent: this.extractStaticContent(currentStep),
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
      }

      const prompt = this.config.greetings.readyPrompt ?? '¿Estás listo?';
      await this.record(sessionId, history.length, studentInput, null);
      await this.record(sessionId, history.length + 1, prompt, 'answer');
      return {
        voiceText: prompt,
        pedagogicalState: 'AWAITING_START',
        staticContent: this.extractStaticContent(currentStep),
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
    }

    // ── Clasificar input ──────────────────────────────────────────────────
    const classification = await this.questionClassifier.classify({
      transcript: studentInput,
      lastTurns: recentHistory,
      lessonMetadata: { title: recipe.title, concepts: [] },
    });
    const action = determineClassificationAction(classification);

    let ragContext: any;
    if (
      action.type === 'ACCEPT' &&
      classification.intent === 'question' &&
      currentState !== 'ACTIVITY_WAIT'
    ) {
      const r = await this.ragService.retrieveChunks({
        atomId: currentAtom.id,
        queryText: studentInput,
        k: 3,
      });
      ragContext = r.chunks;
    }

    let aiResponse: AIResponse;
    try {
      aiResponse = await this.aiService.generateResponse({
        recipe,
        currentState,
        conversationHistory: recentHistory,
        ragContext,
        currentSegment: {
          chunkText: currentAtom.content || currentAtom.title,
          order: currentStep.order,
        },
        totalSegments: steps.length,
        historySummary,
      });
    } catch (e: any) {
      console.warn('[Orchestrator] LLM fallback:', e.message);
      aiResponse = this.getFallbackResponse(currentState, currentAtom.title);
    }

    const canAsk = () => {
      if (questionCount >= this.config.maxQuestionsPerSession) return false;
      if (lastQuestionTime) {
        const ms = Date.now() - new Date(lastQuestionTime).getTime();
        if (ms < this.config.questionCooldownSeconds * 1_000) return false;
      }
      return true;
    };

    let voiceText = aiResponse.explanation;
    let responseFeedback: string | undefined;
    let nextState: PedagogicalState = currentState;
    let nextIdx = currentIdx;
    let willComplete = false;

    // ── Máquina de estados ────────────────────────────────────────────────

    if (currentState === 'ACTIVE_CLASS' || currentState === 'EXPLANATION') {
      if (action.type === 'ACCEPT' && classification.intent === 'question' && canAsk()) {
        questionCount++;
        lastQuestionTime = new Date().toISOString();
        nextState = 'RESOLVING_DOUBT';
        savedStepIndex = currentIdx;
        doubtContext = { question: studentInput, stepIndex: currentIdx };
      } else if (action.type === 'ACCEPT' && classification.intent === 'question') {
        voiceText = 'Continuemos con el tema por ahora.';
        nextState = currentState;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'ACTIVITY_WAIT') {
      const script = currentStep.script;

      if (isQuestionScript(script)) {
        // ── Pregunta de comprensión: evaluar con LLM ─────────────────────
        const evaluation = await this.evaluateAnswer({
          script: script as QuestionScript,
          studentInput,
          attemptNumber: failedAttempts + 1,
          recipeTitle: recipe.title,
          stepIndex: currentIdx,
          studentId: userId,
        });
        const qs = script as QuestionScript;
        if (evaluation.result === 'correct') {
          voiceText = qs.feedback.correct;
          responseFeedback = qs.feedback.correct;
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else if (evaluation.result === 'partial') {
          voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
          nextState = 'ACTIVITY_WAIT';
        } else {
          failedAttempts++;
          voiceText = qs.feedback.incorrect;
          responseFeedback = qs.feedback.incorrect;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      } else if (isActivityScript(script)) {
        // ── Actividad MCQ: comparación directa (sin LLM) ─────────────────
        const as = script as ActivityScript;
        const norm = studentInput.trim().toLowerCase();
        const correct = as.options.find((o) => o.isCorrect);
        const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();

        voiceText = isCorrect ? as.feedback.correct : as.feedback.incorrect;
        responseFeedback = voiceText;

        if (isCorrect) {
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else {
          failedAttempts++;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      }
    } else if (currentState === 'EVALUATION') {
      const lower = studentInput.toLowerCase();
      if (lower.includes('repetir') || lower.includes('otra vez')) {
        const ci = this.findPreviousContentStep(steps, currentIdx) ?? currentIdx;
        nextIdx = ci;
        nextState = this.stateForStep(steps[ci]);
        voiceText = this.buildVoiceText(steps[ci]);
        failedAttempts = 0;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
          failedAttempts = 0;
        }
      }
    } else if (currentState === 'ACTIVITY_SKIP_OFFER') {
      const lower = studentInput.toLowerCase();
      if (lower.includes('repetir') || lower.includes('otra vez')) {
        const ci = this.findPreviousContentStep(steps, currentIdx) ?? currentIdx;
        nextIdx = ci;
        nextState = this.stateForStep(steps[ci]);
        voiceText = this.buildVoiceText(steps[ci]);
        failedAttempts = 0;
      } else {
        skippedActivities = [...skippedActivities, currentStep.atomId];
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'RESOLVING_DOUBT' || currentState === 'CLARIFYING') {
      const ri = savedStepIndex ?? currentIdx;
      nextIdx = ri;
      nextState = this.stateForStep(steps[ri] ?? currentStep);
      savedStepIndex = undefined;
      doubtContext = undefined;
      voiceText = `${aiResponse.explanation} Continuemos donde lo dejamos.`;
    }

    if (willComplete) {
      voiceText = fillTemplate(
        this.config.greetings.completionMessage ?? '¡Felicitaciones! Completaste {title}.',
        { name: 'estudiante', title: recipe.title },
      );
    }

    await this.record(sessionId, history.length, studentInput, null);
    await this.record(sessionId, history.length + 1, voiceText, 'answer');

    const newCp: SessionCheckpoint = {
      currentState: nextState,
      currentStepIndex: nextIdx,
      savedStepIndex,
      doubtContext,
      questionCount,
      lastQuestionTime,
      skippedActivities,
      failedAttempts,
    };

    const persist = async () => {
      if (willComplete) {
        await this.sessionRepo.complete(sessionId);
        await this.emitLessonCompleted(session.studentId, session.recipeId, recipe.title);
      } else await this.sessionRepo.updateCheckpoint(sessionId, newCp);
    };

    if (this.advisoryLockManager) {
      const lockId = createSessionLockId(sessionId);
      await this.advisoryLockManager.acquireLock(lockId);
      try {
        await persist();
      } finally {
        await this.advisoryLockManager.releaseLock(lockId);
      }
    } else {
      await persist();
    }

    // FIX CLAVE: usar nextIdx (paso destino) para el staticContent
    const displayStep = willComplete ? currentStep : (steps[nextIdx] ?? currentStep);
    const staticContent = this.extractStaticContent(displayStep);

    return {
      voiceText,
      pedagogicalState: nextState,
      sessionCompleted: willComplete || undefined,
      feedback: responseFeedback,
      isCorrect: aiResponse.isCorrect,
      staticContent,
      lessonProgress: { currentStep: nextIdx, totalSteps: steps.length },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // interactStream()
  // ─────────────────────────────────────────────────────────────────────────

  async *interactStream(
    sessionId: string,
    studentInput: string,
    userId?: string,
  ): AsyncGenerator<InteractionChunk> {
    // ── Load session ──────────────────────────────────────────────────────────
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (userId && session.studentId !== userId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (session.status !== 'ACTIVE') throw new Error(`Session not active: ${session.status}`);

    const recipe = await this.recipeRepo.findById(session.recipeId);
    if (!recipe) throw new RecipeNotFoundError(session.recipeId);
    this.config = parseRecipeConfig(recipe.meta);

    const steps = await this.recipeRepo.findStepsByRecipeId(session.recipeId);
    if (!steps.length) throw new Error('Recipe has no steps');

    const history = await this.interactionRepo.findBySessionOrdered(sessionId);
    const limited = this.contextWindowService.trimHistory(history);
    const recentHistory = limited.map((h: Interaction) => ({
      role: (h.turnNumber % 2 === 1 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.transcript,
    }));
    const historySummary = this.contextWindowService.summarizeOlderTurns(history);

    const cp = session.stateCheckpoint;
    const currentState = cp.currentState as PedagogicalState;
    const currentIdx = cp.currentStepIndex ?? 0;
    let questionCount = cp.questionCount ?? 0;
    let lastQuestionTime = cp.lastQuestionTime ?? null;
    let skippedActivities: string[] = cp.skippedActivities ?? [];
    let failedAttempts = cp.failedAttempts ?? 0;
    let savedStepIndex: number | undefined = cp.savedStepIndex;
    let doubtContext = cp.doubtContext;

    if (session.safetyFlag || session.outOfScope) {
      await this.sessionRepo.escalate(sessionId);
      yield {
        type: 'end',
        reason: 'completed',
        pedagogicalState: currentState,
        sessionCompleted: true,
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
      return;
    }

    const currentStep = steps[currentIdx];
    if (!currentStep) {
      await this.sessionRepo.complete(sessionId);
      await this.emitLessonCompleted(session.studentId, session.recipeId, recipe.title);
      yield {
        type: 'end',
        reason: 'completed',
        pedagogicalState: 'COMPLETED',
        sessionCompleted: true,
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
      return;
    }

    const currentAtom = await this.atomRepo.findById(currentStep.atomId);
    if (!currentAtom) throw new Error(`Atom ${currentStep.atomId} not found`);

    // ── AWAITING_START fast path (no streaming needed) ──────────────────────
    if (currentState === 'AWAITING_START') {
      const lower = studentInput.toLowerCase();
      const ready = [
        'sí',
        'si',
        'comenzar',
        'start',
        'listo',
        'adelante',
        'vamos',
        'ready',
        'ok',
        'dale',
        'continuar',
      ].some((w) => lower.includes(w));

      if (ready) {
        const vt = this.buildVoiceText(currentStep);
        await this.record(sessionId, history.length, studentInput, null);
        await this.record(sessionId, history.length + 1, vt, 'answer');
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: this.stateForStep(currentStep),
          currentStepIndex: currentIdx,
        });
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: this.stateForStep(currentStep),
          sessionCompleted: false,
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
        return;
      }

      const prompt = this.config.greetings.readyPrompt ?? '¿Estás listo?';
      await this.record(sessionId, history.length, studentInput, null);
      await this.record(sessionId, history.length + 1, prompt, 'answer');
      yield {
        type: 'end',
        reason: 'completed',
        pedagogicalState: 'AWAITING_START',
        sessionCompleted: false,
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
      return;
    }

    // ── Classify input ───────────────────────────────────────────────────────
    const classification = await this.questionClassifier.classify({
      transcript: studentInput,
      lastTurns: recentHistory,
      lessonMetadata: { title: recipe.title, concepts: [] },
    });
    const action = determineClassificationAction(classification);

    let ragContext: any;
    if (
      action.type === 'ACCEPT' &&
      classification.intent === 'question' &&
      currentState !== 'ACTIVITY_WAIT'
    ) {
      const r = await this.ragService.retrieveChunks({
        atomId: currentAtom.id,
        queryText: studentInput,
        k: 3,
      });
      ragContext = r.chunks;
    }

    // ── Stream LLM response ─────────────────────────────────────────────────
    const params = {
      recipe,
      currentState,
      conversationHistory: recentHistory,
      ragContext,
      currentSegment: {
        chunkText: currentAtom.content || currentAtom.title,
        order: currentStep.order,
      },
      totalSegments: steps.length,
      historySummary,
    };

    let fullResponse = '';
    try {
      for await (const chunk of this.aiService.generateResponseStream(params)) {
        fullResponse += chunk;
        yield { type: 'chunk', text: chunk };
      }
    } catch (e: any) {
      console.warn('[Orchestrator] Stream fallback:', e.message);
      fullResponse = this.getFallbackResponse(currentState, currentAtom.title).explanation;
      yield { type: 'chunk', text: fullResponse };
    }

    // ── Compute state machine ────────────────────────────────────────────────
    const canAsk = () => {
      if (questionCount >= this.config.maxQuestionsPerSession) return false;
      if (lastQuestionTime) {
        const ms = Date.now() - new Date(lastQuestionTime).getTime();
        if (ms < this.config.questionCooldownSeconds * 1_000) return false;
      }
      return true;
    };

    let voiceText = fullResponse;
    let nextState: PedagogicalState = currentState;
    let nextIdx = currentIdx;
    let willComplete = false;

    if (currentState === 'ACTIVE_CLASS' || currentState === 'EXPLANATION') {
      if (action.type === 'ACCEPT' && classification.intent === 'question' && canAsk()) {
        questionCount++;
        lastQuestionTime = new Date().toISOString();
        nextState = 'RESOLVING_DOUBT';
        savedStepIndex = currentIdx;
        doubtContext = { question: studentInput, stepIndex: currentIdx };
      } else if (action.type === 'ACCEPT' && classification.intent === 'question') {
        voiceText = 'Continuemos con el tema por ahora.';
        nextState = currentState;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'ACTIVITY_WAIT') {
      const script = currentStep.script;

      if (isQuestionScript(script)) {
        const evaluation = await this.evaluateAnswer({
          script: script as QuestionScript,
          studentInput,
          attemptNumber: failedAttempts + 1,
          recipeTitle: recipe.title,
          stepIndex: currentIdx,
          studentId: userId,
        });
        const qs = script as QuestionScript;
        if (evaluation.result === 'correct') {
          voiceText = qs.feedback.correct;
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else if (evaluation.result === 'partial') {
          voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
          nextState = 'ACTIVITY_WAIT';
        } else {
          failedAttempts++;
          voiceText = qs.feedback.incorrect;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      } else if (isActivityScript(script)) {
        const as = script as ActivityScript;
        const norm = studentInput.trim().toLowerCase();
        const correct = as.options.find((o) => o.isCorrect);
        const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();

        voiceText = isCorrect ? as.feedback.correct : as.feedback.incorrect;

        if (isCorrect) {
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else {
          failedAttempts++;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      }
    } else if (currentState === 'EVALUATION') {
      const lower = studentInput.toLowerCase();
      if (lower.includes('repetir') || lower.includes('otra vez')) {
        const ci = this.findPreviousContentStep(steps, currentIdx) ?? currentIdx;
        nextIdx = ci;
        nextState = this.stateForStep(steps[ci]);
        voiceText = this.buildVoiceText(steps[ci]);
        failedAttempts = 0;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
          failedAttempts = 0;
        }
      }
    } else if (currentState === 'ACTIVITY_SKIP_OFFER') {
      const lower = studentInput.toLowerCase();
      if (lower.includes('repetir') || lower.includes('otra vez')) {
        const ci = this.findPreviousContentStep(steps, currentIdx) ?? currentIdx;
        nextIdx = ci;
        nextState = this.stateForStep(steps[ci]);
        voiceText = this.buildVoiceText(steps[ci]);
        failedAttempts = 0;
      } else {
        skippedActivities = [...skippedActivities, currentStep.atomId];
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'RESOLVING_DOUBT' || currentState === 'CLARIFYING') {
      const ri = savedStepIndex ?? currentIdx;
      nextIdx = ri;
      nextState = this.stateForStep(steps[ri] ?? currentStep);
      savedStepIndex = undefined;
      doubtContext = undefined;
      voiceText = `${fullResponse} Continuemos donde lo dejamos.`;
    }

    if (willComplete) {
      voiceText = fillTemplate(
        this.config.greetings.completionMessage ?? '¡Felicitaciones! Completaste {title}.',
        { name: 'estudiante', title: recipe.title },
      );
    }

    // ── Persist interactions ────────────────────────────────────────────────
    await this.record(sessionId, history.length, studentInput, null);
    await this.record(sessionId, history.length + 1, voiceText, 'answer');

    // ── Persist checkpoint ───────────────────────────────────────────────────
    const newCp: SessionCheckpoint = {
      currentState: nextState,
      currentStepIndex: nextIdx,
      savedStepIndex,
      doubtContext,
      questionCount,
      lastQuestionTime,
      skippedActivities,
      failedAttempts,
    };

    const persist = async () => {
      if (willComplete) {
        await this.sessionRepo.complete(sessionId);
        await this.emitLessonCompleted(session.studentId, session.recipeId, recipe.title);
      } else await this.sessionRepo.updateCheckpoint(sessionId, newCp);
    };

    if (this.advisoryLockManager) {
      const lockId = createSessionLockId(sessionId);
      await this.advisoryLockManager.acquireLock(lockId);
      try {
        await persist();
      } finally {
        await this.advisoryLockManager.releaseLock(lockId);
      }
    } else {
      await persist();
    }

    yield {
      type: 'end',
      reason: 'completed',
      pedagogicalState: nextState,
      sessionCompleted: willComplete,
      lessonProgress: { currentStep: nextIdx, totalSteps: steps.length },
    };
  }
}
