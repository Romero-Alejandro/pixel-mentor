import { randomUUID } from 'node:crypto';
import { config } from '@/shared/config/index.js';

// Helper to extract text from string | {text: string} object
type TextOrTextObject = string | { text: string };
function extractText(val: TextOrTextObject | undefined | null): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'text' in val && typeof val.text === 'string') {
    return val.text;
  }
  return '';
}

import { createLogger } from '@/shared/logger/logger.js';

// Create a logger for orchestrate recipe use case
const orchestrateLogger = createLogger(undefined, { name: 'orchestrate-recipe', level: 'info' });

import type { SessionRepository } from '@/features/session/domain/ports/session.repository.port.js';
import { SessionNotFoundError } from '@/features/session/domain/ports/session.repository.port.js';
import type { InteractionRepository } from '@/features/session/domain/ports/interaction.repository.port.js';
import type { RecipeRepository } from '@/features/recipe/domain/ports/recipe.repository.port.js';
import { RecipeNotFoundError } from '@/features/recipe/domain/ports/recipe.repository.port.js';
import type { ConceptRepository } from '@/features/knowledge/domain/ports/concept.repository.port.js';
import type { ActivityRepository } from '@/features/activity/domain/ports/activity.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port.js';
import type { AIService, AIResponse } from '@/features/recipe/domain/ports/ai-service.port.js';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
  ComprehensionEvaluation,
} from '@/features/recipe/domain/ports/question-classifier.port.js';
import type { RAGService } from '@/features/recipe/domain/ports/rag-service.port.js';
// Metrics imports
import {
  EvaluationMetricsCollector,
  EvaluationTimer,
  type EngineType,
  type EvaluationOutcome,
  type EvaluationErrorType,
} from '@/shared/monitoring/eval-metrics.js';
import type { AdvisoryLockManager } from '@/features/session/domain/ports/advisory-lock.port.js';
import { createSessionLockId } from '@/features/session/domain/ports/advisory-lock.port.js';
import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';
import type { Interaction } from '@/features/session/domain/entities/interaction.entity.js';
import type { SessionCheckpoint } from '@/features/session/domain/entities/session.entity.js';
import type { InteractRecipeOutput, StaticContent, InteractionChunk } from '@/shared/dto/index.js';
import { determineClassificationAction } from '@/features/activity/domain/entities/question-classification.entity.js';
import { ContextWindowService } from '@/features/recipe/application/services/context-window.service.js';
import {
  parseRecipeConfig,
  fillTemplate,
  DEFAULT_CONFIG,
  type RecipeConfig,
} from '@/features/recipe/domain/entities/recipe-config.entity.js';
import { isTerminalStatus } from '@/features/session/domain/entities/session.entity.js';
import { DEFAULT_COHORT as USER_DEFAULT_COHORT } from '@/features/auth/domain/entities/user.entity.js';
import type { LessonEvaluatorUseCase } from '@/features/evaluation/application/services/lesson.evaluator.js';
import type {
  EvaluationRequest,
  EvaluationResult,
  EvaluationOutcome as PedagogicalOutcome,
} from '@/features/evaluation/domain/entities/evaluation-types.js';
import type { FeatureFlagService } from '@/shared/config/evaluation-flags.js';
import type { RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';
import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';

// Gamification imports
import { getEventBus } from '@/shared/events/event-bus.port.js';
import { GameDomainEvents } from '@/shared/events/game-events.port.js';
import type { LessonCompletedPayload } from '@/shared/events/game-events.port.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del script auto-contenido
// ─────────────────────────────────────────────────────────────────────────────

// Type for RAG service returned chunks with similarity scores
type RAGChunk = {
  chunk: KnowledgeChunk;
  similarityScore: number;
  citations?: unknown[];
};

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
  const q = (s as QuestionScript)?.question;
  const opts = (s as ActivityScript)?.options;
  const inst = (s as ActivityScript)?.instruction;

  // If it has options, it's a multiple choice activity - use deterministic comparison
  if (Array.isArray(opts) && opts.length > 0) {
    return false;
  }

  // If it has instruction but no question, it's an activity without options
  if (inst && !q) {
    return false;
  }

  // Accept both string and {text: string} object
  return typeof q === 'string' || (typeof q === 'object' && q !== null && 'text' in q);
}

function isActivityScript(s: unknown): s is ActivityScript {
  const opts = (s as ActivityScript)?.options;
  const inst = (s as ActivityScript)?.instruction;
  // Check if it has options OR has instruction (string or object)
  const hasInstruction =
    typeof inst === 'string' || (typeof inst === 'object' && inst !== null && 'text' in inst);
  return (Array.isArray(opts) && opts.length > 0) || hasInstruction;
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
    private userRepo: IUserRepository,
    private aiService: AIService,
    private questionClassifier: QuestionClassifier,
    private ragService: RAGService,
    private comprehensionEvaluator: ComprehensionEvaluator,
    private lessonEvaluator: LessonEvaluatorUseCase,
    private advisoryLockManager?: AdvisoryLockManager,
    private contextWindowService: ContextWindowService = new ContextWindowService(),
    private featureFlagService?: FeatureFlagService,
    private activityAttemptRepo?: ActivityAttemptRepository,
  ) {
    // Mantenidos para compatibilidad futura
    void this.conceptRepo;
    void this.activityRepo;
  }

  /**
   * Calculate accuracy for a completed lesson.
   * Uses LAST attempt to determine if the student eventually mastered the material.
   * Also tracks if all answers were correct on first attempt for bonus XP.
   */
  private async calculateAccuracy(
    userId: string,
    steps: Array<{ atomId: string; stepType?: string | null }>,
    skippedAtomIds: string[],
  ): Promise<{
    correctFirstAttempts: number;
    correctLastAttempts: number;
    totalActivities: number;
    skippedActivities: number;
    accuracyPercent: number;
    allCorrectOnFirstAttempt: boolean;
    tier: 'perfect' | 'high' | 'medium' | 'low';
  }> {
    const activitySteps = steps.filter(
      (s) => s.stepType === 'activity' || s.stepType === 'question',
    );
    const totalActivities = activitySteps.length;

    let correctFirstAttempts = 0;
    let correctLastAttempts = 0;
    let allCorrectOnFirstAttempt = true;

    if (totalActivities > 0 && this.activityAttemptRepo) {
      for (const step of activitySteps) {
        if (skippedAtomIds.includes(step.atomId)) continue;

        const attempts = await this.activityAttemptRepo.findByUserIdAndAtomId(userId, step.atomId);

        // Sort by attemptNo to get first and last
        const sortedAttempts = attempts.sort((a, b) => a.attemptNo - b.attemptNo);
        const firstAttempt = sortedAttempts[0];
        const lastAttempt = sortedAttempts[sortedAttempts.length - 1];

        // Check first attempt (for bonus calculation)
        if (firstAttempt?.correct) {
          correctFirstAttempts++;
        } else {
          allCorrectOnFirstAttempt = false;
        }

        // Check last attempt (for accuracy calculation - mastery)
        if (lastAttempt?.correct) {
          correctLastAttempts++;
        }
      }
    }

    const skippedActivities = skippedAtomIds.length;
    const attemptedActivities = totalActivities - skippedActivities;

    // Accuracy is based on LAST attempt (mastery)
    const accuracyPercent =
      attemptedActivities > 0 ? Math.round((correctLastAttempts / attemptedActivities) * 100) : 100;

    // Determine tier based on last attempt accuracy
    let tier: 'perfect' | 'high' | 'medium' | 'low';
    if (accuracyPercent >= 100) tier = 'perfect';
    else if (accuracyPercent >= 80) tier = 'high';
    else if (accuracyPercent >= 50) tier = 'medium';
    else tier = 'low';

    return {
      correctFirstAttempts,
      correctLastAttempts,
      totalActivities,
      skippedActivities,
      accuracyPercent,
      allCorrectOnFirstAttempt,
      tier,
    };
  }

  /**
   * Emit LESSON_COMPLETED event to trigger gamification processing (XP, badges, streaks).
   * Calculates accuracy from ActivityAttempt records and includes it in the payload.
   * Wrapped in try/catch so gamification failures never break session completion.
   */
  private async emitLessonCompleted(
    userId: string,
    lessonId: string,
    lessonTitle: string,
    steps: Array<{ atomId: string; stepType?: string | null }>,
    skippedAtomIds: string[],
  ): Promise<void> {
    try {
      const eventBus = getEventBus();

      // Calculate accuracy
      const accuracyData = await this.calculateAccuracy(userId, steps, skippedAtomIds);

      const payload: LessonCompletedPayload = {
        userId,
        lessonId,
        lessonTitle,
        completedAt: new Date(),
        accuracy: accuracyData,
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
    if (!stepType) return undefined;

    // Even if script is null/undefined, return a basic staticContent with stepType
    if (!script) {
      return {
        stepType: 'content' as const,
        script: {
          transition: '',
          content: '',
          examples: [],
          closure: '',
        },
      };
    }

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
    // Always respect stepType — type guard is only for extracting data
    if (stepType === 'question') {
      const questionText = isQuestionScript(script)
        ? extractText((script as QuestionScript).question)
        : '';
      const fb = isQuestionScript(script)
        ? (script as QuestionScript).feedback
        : { correct: '', incorrect: '' };
      const hint = isQuestionScript(script) ? (script as QuestionScript).hint : undefined;
      return {
        stepType: 'activity', // La UI lo trata como panel interactivo
        script: {
          transition: extractText(
            isQuestionScript(script) ? (script as QuestionScript).transition : '',
          ),
          content: questionText,
          examples: [],
          closure: '',
        },
        activity: {
          instruction: questionText,
          options: [], // Sin opciones = input libre en el frontend
          feedback: {
            correct: fb.correct,
            incorrect: fb.incorrect,
            partial: hint,
          },
        },
      };
    }

    // ── Actividad / examen (opción múltiple) ──────────────────────────────
    // Always respect stepType — type guard is only for extracting data
    if (stepType === 'activity' || stepType === 'exam') {
      const instructionText = isActivityScript(script)
        ? extractText((script as ActivityScript).instruction)
        : '';
      const safeOptions =
        isActivityScript(script) && Array.isArray((script as ActivityScript).options)
          ? (script as ActivityScript).options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
            }))
          : [];
      const fb = isActivityScript(script)
        ? (script as ActivityScript).feedback
        : { correct: '', incorrect: '' };
      return {
        stepType: 'activity',
        script: {
          transition: extractText(
            isActivityScript(script) ? (script as ActivityScript).transition : '',
          ),
          content: instructionText,
          examples: [],
          closure: extractText(isActivityScript(script) ? (script as ActivityScript).closure : ''),
        },
        activity: {
          instruction: instructionText,
          options: safeOptions,
          feedback: {
            correct: fb.correct ?? '',
            incorrect: fb.incorrect ?? '',
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

    // Helper to extract text from either string or { text } object
    const txt = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (
        val &&
        typeof val === 'object' &&
        'text' in val &&
        typeof (val as { text: unknown }).text === 'string'
      ) {
        return (val as { text: string }).text;
      }
      return '';
    };

    if (stepType === 'question' && isQuestionScript(script)) {
      return [txt(script.transition), txt(script.question)].filter(Boolean).join(' ');
    }
    if ((stepType === 'activity' || stepType === 'exam') && isActivityScript(script)) {
      return [txt(script.transition), txt(script.instruction)].filter(Boolean).join(' ');
    }
    const s = script as ContentScript;
    return [txt(s.transition), txt(s.content), txt(s.closure)].filter(Boolean).join(' ');
  }

  // ─── Helpers de clasificación de paso ───────────────────────────────────

  private requiresStudentInput(stepType?: string | null): boolean {
    return stepType === 'activity' || stepType === 'exam' || stepType === 'question';
  }

  private stateForStep(step: { stepType?: string | null }): PedagogicalState {
    return this.requiresStudentInput(step?.stepType) ? 'ACTIVITY_WAIT' : 'EXPLANATION';
  }

  private advanceStep(steps: readonly RecipeStep[], current: number): number | null {
    const next = current + 1;
    return next < steps.length ? next : null;
  }

  /**
   * Build an array of content-only steps for the frontend to auto-advance through.
   * Excludes question and activity steps which require student interaction.
   */
  private buildContentSteps(steps: readonly RecipeStep[]): Array<{
    stepIndex: number;
    stepType: 'content' | 'intro' | 'closure';
    staticContent: StaticContent;
  }> {
    const result: Array<{
      stepIndex: number;
      stepType: 'content' | 'intro' | 'closure';
      staticContent: StaticContent;
    }> = [];
    for (let idx = 0; idx < steps.length; idx++) {
      const step = steps[idx];
      if (!this.requiresStudentInput(step.stepType)) {
        const sc = this.extractStaticContent(step);
        if (sc) {
          result.push({
            stepIndex: idx,
            stepType: (step.stepType ?? 'content') as 'content' | 'intro' | 'closure',
            staticContent: sc,
          });
        }
      }
    }
    return result;
  }

  private findPreviousContentStep(steps: readonly RecipeStep[], from: number): number | null {
    for (let i = from - 1; i >= 0; i--) {
      if (!this.requiresStudentInput(steps[i].stepType)) return i;
    }
    return null;
  }

  /**
   * Count how many consecutive recent interactions returned the same step index.
   * Used for loop detection — if the same step is returned too many times,
   * the orchestrator is stuck and needs to force-advance.
   */

  private getFallbackResponse(state: PedagogicalState, title: string): AIResponse {
    return {
      explanation: `Continuemos con ${title}.`,
      supportQuotes: [],
      pedagogicalState: state,
    };
  }

  private async record(
    sessionId: string,
    turnBase: number,
    text: string,
    type: string | null,
    stepIndex?: number,
  ) {
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: turnBase + 1,
      transcript: text,
      aiResponse: type
        ? {
            text,
            responseType: type,
            metadata: stepIndex !== undefined ? { stepIndex } : undefined,
          }
        : null,
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

    // DEBUG: Log the evaluation request
    orchestrateLogger.debug(
      {
        studentAnswer: studentInput,
        questionText: script.question,
        expectedAnswer: script.expectedAnswer,
      },
      '[DEBUG] evaluateWithLessonEngine - calling LLM',
    );

    try {
      const result: EvaluationResult = await this.lessonEvaluator.evaluate(request);

      // DEBUG: Log the LLM result
      orchestrateLogger.debug(
        {
          outcome: result.outcome,
          score: result.score,
          feedback: result.feedback,
          confidence: result.confidence,
        },
        '[DEBUG] evaluateWithLessonEngine - LLM result',
      );

      // Map 6-category EvaluationOutcome to 3-category ComprehensionEvaluation
      // This mapping ensures backward compatibility with the frontend
      const pedagogicalOutcome = result.outcome as PedagogicalOutcome;
      const mappedResult = this.mapPedagogicalOutcomeToComprehension(pedagogicalOutcome);

      // Map confidence (normalize if needed)
      const mappedConfidence = this.normalizePedagogicalConfidence(
        result.confidence,
        pedagogicalOutcome,
      );

      return {
        result: mappedResult,
        confidence: mappedConfidence,
        hint: result.improvementSuggestion,
        shouldEscalate: this.shouldEscalateBasedOnPedagogicalOutcome(pedagogicalOutcome),
      };
    } catch (error) {
      // Graceful fallback to incorrect on error
      const errorMessage = error instanceof Error ? error.message : String(error);
      orchestrateLogger.error({ err: errorMessage }, '[OrchestrateRecipe] LessonEvaluator error');
      return {
        result: 'incorrect',
        confidence: 0,
        hint: script.hint,
        shouldEscalate: false,
      };
    }
  }

  /**
   * Maps the 6-category pedagogical outcome to the 3-category legacy outcome.
   * This ensures backward compatibility with the frontend while using the new evaluator.
   */
  private mapPedagogicalOutcomeToComprehension(
    outcome: PedagogicalOutcome,
  ): 'correct' | 'partial' | 'incorrect' {
    switch (outcome) {
      case 'conceptually_correct':
      case 'intuitive_correct':
        return 'correct';
      case 'partially_correct':
      case 'relevant_but_incomplete':
        return 'partial';
      case 'conceptual_error':
      case 'no_response':
        return 'incorrect';
      default:
        // Fallback for any unknown outcome
        return 'incorrect';
    }
  }

  /**
   * Normalizes confidence based on the pedagogical evaluation outcome.
   * Higher confidence for correct answers, lower for partial.
   */
  private normalizePedagogicalConfidence(confidence: number, outcome: PedagogicalOutcome): number {
    // Ensure confidence is between 0 and 1
    const normalized = Math.max(0, Math.min(1, confidence));

    // Boost confidence for conceptually correct answers
    if (outcome === 'conceptually_correct' && normalized < 0.8) {
      return 0.9;
    }

    // Keep higher confidence for intuitive correct (shows understanding)
    if (outcome === 'intuitive_correct' && normalized < 0.7) {
      return 0.8;
    }

    return normalized;
  }

  /**
   * Determines if the evaluation should escalate based on the pedagogical outcome.
   * Used to trigger additional help for struggling students.
   */
  private shouldEscalateBasedOnPedagogicalOutcome(outcome: PedagogicalOutcome): boolean {
    // Escalate on conceptual errors or no response to provide extra support
    return outcome === 'conceptual_error' || outcome === 'no_response';
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
    orchestrateLogger.info(
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

      orchestrateLogger.info(
        `[EVAL COMPLETE] engine=${engineType} outcome=${outcome} latency=${latencyMs}ms cohort=${cohort} requestId=${metrics.getRequestId()}`,
      );

      // Call the tracking completion function
      completeTracking(outcome);

      return result;
    } catch (error) {
      // Record error metrics
      const latencyMs = timer.getElapsed();
      const errorType = this.categorizeError(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.recordError(errorType, errorMessage);

      orchestrateLogger.error(
        {
          err: error,
          engine: engineType,
          errorType,
          latencyMs,
          cohort,
          requestId: metrics.getRequestId(),
        },
        `[EVAL ERROR] engine=${engineType} error=${errorType} latency=${latencyMs}ms cohort=${cohort} requestId=${metrics.getRequestId()}`,
      );

      // Call the tracking completion function with error
      completeTracking(undefined, errorType, errorMessage);

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
      orchestrateLogger.warn(
        { studentId },
        '[OrchestrateRecipe] Failed to fetch student cohort, using default',
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      orchestrateLogger.error(
        { err: errorMessage, cohort },
        `[OrchestrateRecipe] FeatureFlagService error for cohort ${cohort}`,
      );
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

    // Case 1: Active session exists → resume it
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
        contentSteps: this.buildContentSteps(steps),
      };
    }

    // Case 2: Completed/Escalated session exists → reuse it (reset instead of creating new)
    if (existing && isTerminalStatus(existing.status)) {
      // Delete old interactions to clean up DB
      await this.interactionRepo.deleteBySession(existing.id);
      // Reset the session to initial state and set to ACTIVE
      const resetSession = await this.sessionRepo.resetProgress(existing.id);
      // Update to ACTIVE status (resetProgress sets IDLE)
      await this.sessionRepo.updateStatus(resetSession.id, 'ACTIVE');

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

      await this.record(resetSession.id, 0, voiceText, 'greeting');

      return {
        sessionId: resetSession.id,
        voiceText,
        pedagogicalState: 'AWAITING_START' as PedagogicalState,
        staticContent: this.extractStaticContent(steps[0]),
        config: this.config as unknown as Record<string, unknown>,
        resumed: false,
        needsStart: true,
        isRepeat: true,
        lessonProgress: { currentStep: 0, totalSteps: steps.length },
        contentSteps: this.buildContentSteps(steps),
      };
    }

    // Case 3: No session exists → create new one
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
    ].join(' ');

    // Create session directly with ACTIVE status to avoid race conditions
    await this.sessionRepo.create({
      id: sessionId,
      studentId,
      recipeId,
      status: 'ACTIVE',
      stateCheckpoint: {
        currentState: 'AWAITING_START',
        currentStepIndex: 0,
        questionCount: 0,
        lastQuestionTime: null,
        skippedActivities: [],
        failedAttempts: 0,
      },
    });
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
      contentSteps: this.buildContentSteps(steps),
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
    orchestrateLogger.debug(
      { sessionId, status: session?.status, state: session?.stateCheckpoint?.currentState },
      '[interact] Session from DB',
    );
    if (!session) throw new SessionNotFoundError(sessionId);
    if (userId && session.studentId !== userId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    // Allow both ACTIVE and IDLE status - IDLE sessions can still interact
    if (session.status !== 'ACTIVE' && session.status !== 'IDLE')
      throw new Error(`Session not active: ${session.status}`);

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
    let totalWrongAnswers = cp.totalWrongAnswers ?? 0;
    let savedStepIndex: number | undefined = cp.savedStepIndex ?? undefined;
    let doubtContext = cp.doubtContext ?? undefined;

    // ── Loop detection: track recent step transitions ──────────────────────
    // If the same step index is returned too many times, force-advance

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
      await this.emitLessonCompleted(
        session.studentId,
        session.recipeId,
        recipe.title,
        steps,
        skippedActivities,
      );
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
        await this.record(sessionId, history.length, studentInput, null, currentIdx);
        await this.record(sessionId, history.length + 1, vt, 'answer', currentIdx);
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
      await this.record(sessionId, history.length, studentInput, null, currentIdx);
      await this.record(sessionId, history.length + 1, prompt, 'answer', currentIdx);
      return {
        voiceText: prompt,
        pedagogicalState: 'AWAITING_START',
        staticContent: this.extractStaticContent(currentStep),
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
    }

    // ── Navigation Fast Path ─────────────────────────────────────────────
    // Skip LLM calls for simple navigation inputs like "continuar", "siguiente", etc.
    // These inputs should just advance to the next step using static content.
    const navWords = [
      'continuar',
      'siguiente',
      'next',
      'ok',
      'dale',
      'vamos',
      'adelante',
      'seguir',
      'avanzar',
      'proseguir',
      'forward',
    ];
    const lowerInput = studentInput.toLowerCase().trim();
    const isNavInput = navWords.some((w) => lowerInput === w || lowerInput.includes(w));

    // Navigation fast path: only for states where advancing is the expected action
    // Skip for ACTIVITY_WAIT (needs answer evaluation) and RESOLVING_DOUBT (needs doubt resolution)
    if (isNavInput && !['ACTIVITY_WAIT', 'RESOLVING_DOUBT', 'CLARIFYING'].includes(currentState)) {
      const navNextIdx = this.advanceStep(steps, currentIdx);
      if (navNextIdx === null) {
        // No more steps — complete the lesson
        await this.sessionRepo.complete(sessionId);
        await this.emitLessonCompleted(
          session.studentId,
          session.recipeId,
          recipe.title,
          steps,
          skippedActivities,
        );
        return {
          voiceText: fillTemplate(this.config.greetings.completionMessage ?? '¡Felicitaciones!', {
            name: 'estudiante',
            title: recipe.title,
          }),
          pedagogicalState: 'COMPLETED' as PedagogicalState,
          sessionCompleted: true,
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
      }

      const nextStep = steps[navNextIdx];
      const nextStepType = nextStep?.stepType as string | undefined;
      const nextScript = nextStep?.script;

      // For question steps, transition to ACTIVITY_WAIT
      // Always respect stepType — the type guard is only for extracting data
      if (nextStep?.stepType === 'question') {
        const questionText = isQuestionScript(nextScript)
          ? extractText((nextScript as QuestionScript).question)
          : this.buildVoiceText(nextStep);
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: navNextIdx,
          savedStepIndex,
          doubtContext,
          questionCount,
          lastQuestionTime,
          skippedActivities,
          failedAttempts,
          totalWrongAnswers,
        });
        return {
          voiceText: questionText || '¿Puedes responder esta pregunta?',
          pedagogicalState: 'ACTIVITY_WAIT' as PedagogicalState,
          staticContent: this.extractStaticContent(nextStep),
          lessonProgress: { currentStep: navNextIdx, totalSteps: steps.length },
        };
      }

      // For activity steps, transition to ACTIVITY_WAIT
      if (nextStepType === 'activity' || nextStepType === 'exam') {
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: navNextIdx,
          savedStepIndex,
          doubtContext,
          questionCount,
          lastQuestionTime,
          skippedActivities,
          failedAttempts,
          totalWrongAnswers,
        });
        return {
          voiceText: this.buildVoiceText(nextStep),
          pedagogicalState: 'ACTIVITY_WAIT' as PedagogicalState,
          staticContent: this.extractStaticContent(nextStep),
          lessonProgress: { currentStep: navNextIdx, totalSteps: steps.length },
        };
      }

      // For content/intro/closure steps, advance normally with static content
      const navVoiceText = this.buildVoiceText(nextStep);
      const navNextState = this.stateForStep(nextStep);
      await this.sessionRepo.updateCheckpoint(sessionId, {
        ...cp,
        currentState: navNextState,
        currentStepIndex: navNextIdx,
        savedStepIndex,
        doubtContext,
        questionCount,
        lastQuestionTime,
        skippedActivities,
        failedAttempts,
        totalWrongAnswers,
      });
      return {
        voiceText: navVoiceText,
        pedagogicalState: navNextState as PedagogicalState,
        staticContent: this.extractStaticContent(nextStep),
        lessonProgress: { currentStep: navNextIdx, totalSteps: steps.length },
      };
    }

    // ── Clasificar input ──────────────────────────────────────────────────
    const classification = await this.questionClassifier.classify({
      transcript: studentInput,
      lastTurns: recentHistory,
      lessonMetadata: { title: recipe.title, concepts: [] },
    });
    const action = determineClassificationAction(classification);
    orchestrateLogger.debug(
      { intent: classification.intent, confidence: classification.confidence, action: action.type },
      '[DEBUG] Classification result',
    );

    let ragContext: RAGChunk[] | undefined;
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
          chunkText:
            typeof currentAtom.content === 'string' ? currentAtom.content : currentAtom.title,
          order: currentStep.order,
        },
        totalSegments: steps.length,
        historySummary,
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      orchestrateLogger.warn({ err: errorMessage }, '[Orchestrator] LLM fallback');
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
    let isCorrectValue: boolean | undefined;

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
      const script = currentStep.script as any;
      // Use string type assertion to avoid strict type issues
      const stepType = currentStep.stepType as string;

      orchestrateLogger.info(
        {
          stepIndex: currentIdx,
          stepType,
          studentInput,
          scriptHasOptions: !!(script as any)?.options,
          scriptOptionsLength: (script as any)?.options?.length,
        },
        '[ACTIVITY_WAIT] Processing student input',
      );

      // PRIORITY: Use stepType to determine evaluation method
      // - 'question' steps use LLM (free response)
      // - 'activity'/'exam' steps use deterministic comparison (MCQ)
      if (stepType === 'question') {
        orchestrateLogger.info('[ACTIVITY_WAIT] Using LLM for question step');
        // Always use LLM for question steps (free response)
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
          isCorrectValue = true;
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else if (evaluation.result === 'partial') {
          voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
          isCorrectValue = false;
          nextState = 'ACTIVITY_WAIT';
        } else {
          failedAttempts++;
          totalWrongAnswers++;
          voiceText = qs.feedback.incorrect;
          responseFeedback = qs.feedback.incorrect;
          isCorrectValue = false;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      } else if (stepType === 'activity') {
        // Use deterministic comparison for activity steps (MCQ)
        // ── Actividad MCQ: comparación directa (sin LLM) ─────────────────
        const as = script as ActivityScript;
        const norm = studentInput.trim().toLowerCase();
        const correct = as.options.find((o) => o.isCorrect);
        const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();

        orchestrateLogger.info(
          {
            studentInput,
            norm,
            correctOption: correct?.text,
            correctTextNormalized: correct?.text.trim().toLowerCase(),
            isCorrect,
            options: as.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          },
          '[ACTIVITY_WAIT] MCQ deterministic comparison - isCorrect: ' + isCorrect,
        );

        voiceText = isCorrect ? as.feedback.correct : as.feedback.incorrect;
        responseFeedback = voiceText;
        isCorrectValue = isCorrect;

        if (isCorrect) {
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else {
          failedAttempts++;
          totalWrongAnswers++;
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
      } else if (
        lower.includes('continuar') ||
        lower.includes('siguiente') ||
        lower.includes('ok') ||
        lower.includes('dale') ||
        lower.includes('vamos') ||
        lower.includes('adelante')
      ) {
        // Navigation input from EVALUATION — advance to next step
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
      } else {
        // Non-navigation input from EVALUATION — re-evaluate as a retry attempt
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
            responseFeedback = qs.feedback.correct;
            isCorrectValue = true;
            nextState = 'EVALUATION';
            failedAttempts = 0;
          } else if (evaluation.result === 'partial') {
            voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
            isCorrectValue = false;
            nextState = 'ACTIVITY_WAIT';
          } else {
            failedAttempts++;
            totalWrongAnswers++;
            voiceText = qs.feedback.incorrect;
            responseFeedback = qs.feedback.incorrect;
            isCorrectValue = false;
            nextState =
              failedAttempts >= this.config.skipAfterFailedAttempts &&
              this.config.enableActivitySkip
                ? 'ACTIVITY_SKIP_OFFER'
                : 'EVALUATION';
          }
        } else if (isActivityScript(script)) {
          const as = script as ActivityScript;
          const norm = studentInput.trim().toLowerCase();
          const correct = as.options.find((o) => o.isCorrect);
          const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();
          voiceText = isCorrect ? as.feedback.correct : as.feedback.incorrect;
          responseFeedback = voiceText;
          isCorrectValue = isCorrect;
          if (isCorrect) {
            nextState = 'EVALUATION';
            failedAttempts = 0;
          } else {
            failedAttempts++;
            totalWrongAnswers++;
            nextState =
              failedAttempts >= this.config.skipAfterFailedAttempts &&
              this.config.enableActivitySkip
                ? 'ACTIVITY_SKIP_OFFER'
                : 'EVALUATION';
          }
        } else {
          // Not a question/activity step — just advance
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

    await this.record(sessionId, history.length, studentInput, null, currentIdx);
    await this.record(sessionId, history.length + 1, voiceText, 'answer', currentIdx);

    const newCp: SessionCheckpoint = {
      currentState: nextState,
      currentStepIndex: nextIdx,
      savedStepIndex,
      doubtContext,
      questionCount,
      lastQuestionTime,
      skippedActivities,
      failedAttempts,
      totalWrongAnswers,
    };

    const persist = async () => {
      if (willComplete) {
        // Save checkpoint (including failedAttempts) BEFORE marking as completed
        await this.sessionRepo.updateCheckpoint(sessionId, newCp);
        await this.sessionRepo.complete(sessionId);
        await this.emitLessonCompleted(
          session.studentId,
          session.recipeId,
          recipe.title,
          steps,
          skippedActivities,
        );
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
    orchestrateLogger.debug(
      {
        nextIdx,
        currentIdx,
        willComplete,
        stepType: displayStep?.stepType,
        hasScript: !!displayStep?.script,
      },
      '[DEBUG] extractStaticContent',
    );
    const staticContent = this.extractStaticContent(displayStep);

    // Calculate accuracy and XP for completed lessons
    let xpEarned: number | undefined;
    let accuracyData: InteractRecipeOutput['accuracy'] = undefined;
    if (willComplete && session.studentId) {
      const accuracy = await this.calculateAccuracy(session.studentId, steps, skippedActivities);
      const { calculateXPFromAccuracy } =
        await import('@/features/gamification/application/strategies/xp-reward.strategy.js');
      xpEarned = calculateXPFromAccuracy(accuracy.accuracyPercent);
      accuracyData = accuracy;
    }

    return {
      voiceText,
      pedagogicalState: nextState,
      sessionCompleted: willComplete || undefined,
      feedback: responseFeedback,
      isCorrect: isCorrectValue ?? aiResponse.isCorrect,
      staticContent,
      lessonProgress: { currentStep: nextIdx, totalSteps: steps.length },
      xpEarned,
      accuracy: accuracyData,
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
    orchestrateLogger.debug(
      {
        stepsCount: steps.length,
        recipeId: session.recipeId,
        currentStepIndex: session.stateCheckpoint?.currentStepIndex ?? 0,
      },
      '[DEBUG] interactStream() - Steps loaded',
    );
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
    let totalWrongAnswers = cp.totalWrongAnswers ?? 0;
    let savedStepIndex: number | undefined = cp.savedStepIndex ?? undefined;
    let doubtContext = cp.doubtContext ?? undefined;

    // ── Loop detection: track recent step transitions ──────────────────────
    // If the same step index is returned too many times, force-advance

    if (session.safetyFlag || session.outOfScope) {
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
      await this.emitLessonCompleted(
        session.studentId,
        session.recipeId,
        recipe.title,
        steps,
        skippedActivities,
      );
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

    // ── ACTIVITY_WAIT fast path (no streaming needed) ────────────────────────
    // Skip LLM calls and use deterministic MCQ evaluation for activity steps
    if (currentState === 'ACTIVITY_WAIT') {
      const script = currentStep.script as any;
      const stepType = currentStep.stepType as string;

      orchestrateLogger.info(
        {
          stepIndex: currentIdx,
          stepType,
          studentInput,
          scriptKeys: script ? Object.keys(script) : [],
          hasOptions: Array.isArray(script?.options) && script.options.length > 0,
          options: script?.options,
        },
        '[interactStream] ACTIVITY_WAIT - processing answer',
      );

      if (stepType === 'activity') {
        // MCQ: deterministic comparison (NO LLM)
        const as = script as ActivityScript;
        const norm = studentInput.trim().toLowerCase();

        // Debug: log all options
        orchestrateLogger.info(
          {
            allOptions: as.options?.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
            studentInput,
            norm,
          },
          '[interactStream] MCQ options before finding correct',
        );

        const correct = as.options?.find((o) => o.isCorrect);
        const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();

        orchestrateLogger.info(
          {
            studentInput,
            norm,
            correctOption: correct?.text,
            correctOptionNormalized: correct?.text.trim().toLowerCase(),
            isCorrect,
          },
          '[interactStream] MCQ deterministic comparison result',
        );

        const feedback = isCorrect ? as.feedback.correct : as.feedback.incorrect;

        await this.record(sessionId, history.length, studentInput, null, currentIdx);
        await this.record(sessionId, history.length + 1, feedback, 'answer', currentIdx);

        const nextState = isCorrect ? 'EVALUATION' : 'EVALUATION';

        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: nextState,
          currentStepIndex: currentIdx,
          savedStepIndex,
          doubtContext,
          questionCount,
          lastQuestionTime,
          skippedActivities,
          failedAttempts: isCorrect ? 0 : failedAttempts + 1,
          totalWrongAnswers: isCorrect ? totalWrongAnswers : totalWrongAnswers + 1,
        });

        yield { type: 'chunk', text: feedback };
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: nextState,
          sessionCompleted: false,
          feedback,
          isCorrect,
          staticContent: this.extractStaticContent(currentStep),
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
        return;
      } else if (stepType === 'question') {
        // Question: use LLM evaluation (will be handled below)
        orchestrateLogger.info('[interactStream] ACTIVITY_WAIT - using LLM for question step');
      }
    }

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
        await this.record(sessionId, history.length, studentInput, null, currentIdx);
        await this.record(sessionId, history.length + 1, vt, 'answer', currentIdx);
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: this.stateForStep(currentStep),
          currentStepIndex: currentIdx,
        });
        yield { type: 'chunk', text: vt };
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: this.stateForStep(currentStep),
          sessionCompleted: false,
          staticContent: this.extractStaticContent(currentStep),
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
        return;
      }

      const prompt = this.config.greetings.readyPrompt ?? '¿Estás listo?';
      await this.record(sessionId, history.length, studentInput, null, currentIdx);
      await this.record(sessionId, history.length + 1, prompt, 'answer', currentIdx);
      yield {
        type: 'end',
        reason: 'completed',
        pedagogicalState: 'AWAITING_START',
        sessionCompleted: false,
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
      return;
    }

    // ── Navigation Fast Path (streaming) ─────────────────────────────────
    // Skip LLM calls for simple navigation inputs. Use static content only.
    const navWords = [
      'continuar',
      'siguiente',
      'next',
      'ok',
      'dale',
      'vamos',
      'adelante',
      'seguir',
      'avanzar',
      'proseguir',
      'forward',
    ];
    const lowerInput = studentInput.toLowerCase().trim();
    const isNavInput = navWords.some((w) => lowerInput === w || lowerInput.includes(w));

    if (isNavInput && !['ACTIVITY_WAIT', 'RESOLVING_DOUBT', 'CLARIFYING'].includes(currentState)) {
      const navNextIdx = this.advanceStep(steps, currentIdx);
      if (navNextIdx === null) {
        await this.sessionRepo.complete(sessionId);
        await this.emitLessonCompleted(
          session.studentId,
          session.recipeId,
          recipe.title,
          steps,
          skippedActivities,
        );
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: 'COMPLETED',
          sessionCompleted: true,
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
        return;
      }

      const nextStep = steps[navNextIdx];
      const nextScript = nextStep?.script;

      // For question steps, transition to ACTIVITY_WAIT
      // Always respect stepType — the type guard is only for extracting data
      if (nextStep?.stepType === 'question') {
        const questionText = isQuestionScript(nextScript)
          ? extractText((nextScript as QuestionScript).question)
          : this.buildVoiceText(nextStep);
        const navVoiceText = questionText || '¿Puedes responder esta pregunta?';
        await this.record(sessionId, history.length, studentInput, null, currentIdx);
        await this.record(sessionId, history.length + 1, navVoiceText, 'answer', currentIdx);
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: navNextIdx,
          savedStepIndex,
          doubtContext,
          questionCount,
          lastQuestionTime,
          skippedActivities,
          failedAttempts,
          totalWrongAnswers,
        });
        yield { type: 'chunk', text: navVoiceText };
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: 'ACTIVITY_WAIT',
          sessionCompleted: false,
          staticContent: this.extractStaticContent(nextStep),
          lessonProgress: { currentStep: navNextIdx, totalSteps: steps.length },
        };
        return;
      }

      // For activity steps, transition to ACTIVITY_WAIT
      const nextStepType = nextStep?.stepType as string | undefined;
      if (nextStepType === 'activity' || nextStepType === 'exam') {
        const navVoiceText = this.buildVoiceText(nextStep);
        await this.record(sessionId, history.length, studentInput, null, currentIdx);
        await this.record(sessionId, history.length + 1, navVoiceText, 'answer', currentIdx);
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: navNextIdx,
          savedStepIndex,
          doubtContext,
          questionCount,
          lastQuestionTime,
          skippedActivities,
          failedAttempts,
          totalWrongAnswers,
        });
        yield { type: 'chunk', text: navVoiceText };
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: 'ACTIVITY_WAIT',
          sessionCompleted: false,
          staticContent: this.extractStaticContent(nextStep),
          lessonProgress: { currentStep: navNextIdx, totalSteps: steps.length },
        };
        return;
      }

      // For content/intro/closure steps, stream static content
      const navVoiceText = this.buildVoiceText(nextStep);
      const navNextState = this.stateForStep(nextStep);
      await this.record(sessionId, history.length, studentInput, null, currentIdx);
      await this.record(sessionId, history.length + 1, navVoiceText, 'answer', currentIdx);
      await this.sessionRepo.updateCheckpoint(sessionId, {
        ...cp,
        currentState: navNextState,
        currentStepIndex: navNextIdx,
        savedStepIndex,
        doubtContext,
        questionCount,
        lastQuestionTime,
        skippedActivities,
        failedAttempts,
        totalWrongAnswers,
      });
      yield { type: 'chunk', text: navVoiceText };
      yield {
        type: 'end',
        reason: 'completed',
        pedagogicalState: navNextState,
        sessionCompleted: false,
        staticContent: this.extractStaticContent(nextStep),
        lessonProgress: { currentStep: navNextIdx, totalSteps: steps.length },
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
        chunkText:
          typeof currentAtom.content === 'string' ? currentAtom.content : currentAtom.title,
        order: currentStep.order,
      },
      totalSegments: steps.length,
      historySummary,
    };

    let fullResponse = '';
    try {
      let chunkCount = 0;
      for await (const chunk of this.aiService.generateResponseStream(params)) {
        fullResponse += chunk;
        chunkCount++;
        if (config.NODE_ENV === 'development') {
          orchestrateLogger.debug(
            {
              chunkNumber: chunkCount,
              chunkLength: chunk.length,
              totalLength: fullResponse.length,
            },
            '[interactStream] Yielding chunk',
          );
        }
        yield { type: 'chunk', text: chunk };
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      orchestrateLogger.warn({ err: errorMessage }, '[Orchestrator] Stream fallback');
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
      const script = currentStep.script as any;
      const stepType = currentStep.stepType as string;

      // Use stepType to determine evaluation method (same as interact() method)
      if (stepType === 'question') {
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
          totalWrongAnswers++;
          voiceText = qs.feedback.incorrect;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      } else if (stepType === 'activity') {
        const as = script as ActivityScript;
        const norm = studentInput.trim().toLowerCase();
        const correct = as.options.find((o) => o.isCorrect);
        const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();

        orchestrateLogger.info(
          {
            stepIndex: currentIdx,
            stepType,
            studentInput,
            norm,
            correctOption: correct?.text,
            isCorrect,
          },
          '[interactStream ACTIVITY_WAIT] MCQ deterministic comparison',
        );

        voiceText = isCorrect ? as.feedback.correct : as.feedback.incorrect;

        if (isCorrect) {
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else {
          failedAttempts++;
          totalWrongAnswers++;
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
      } else if (
        lower.includes('continuar') ||
        lower.includes('siguiente') ||
        lower.includes('ok') ||
        lower.includes('dale') ||
        lower.includes('vamos') ||
        lower.includes('adelante')
      ) {
        // Navigation input from EVALUATION — advance to next step
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
      } else {
        // Non-navigation input from EVALUATION — re-evaluate as a retry attempt
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
            totalWrongAnswers++;
            voiceText = qs.feedback.incorrect;

            nextState =
              failedAttempts >= this.config.skipAfterFailedAttempts &&
              this.config.enableActivitySkip
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
            totalWrongAnswers++;
            nextState =
              failedAttempts >= this.config.skipAfterFailedAttempts &&
              this.config.enableActivitySkip
                ? 'ACTIVITY_SKIP_OFFER'
                : 'EVALUATION';
          }
        } else {
          // Not a question/activity step — just advance
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
    await this.record(sessionId, history.length, studentInput, null, currentIdx);
    await this.record(sessionId, history.length + 1, voiceText, 'answer', currentIdx);

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
      totalWrongAnswers,
    };

    const persist = async () => {
      if (willComplete) {
        // Save checkpoint (including failedAttempts) BEFORE marking as completed
        await this.sessionRepo.updateCheckpoint(sessionId, newCp);
        await this.sessionRepo.complete(sessionId);
        await this.emitLessonCompleted(
          session.studentId,
          session.recipeId,
          recipe.title,
          steps,
          skippedActivities,
        );
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
  catch(_error: unknown) {
    // Silently swallow errors — caller handles them
  }
}
