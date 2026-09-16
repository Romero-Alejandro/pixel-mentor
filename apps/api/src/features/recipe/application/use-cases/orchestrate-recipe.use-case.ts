import { randomUUID } from 'node:crypto';
import { config } from '@/shared/config/index.js';
import { isMockRecipeId, getMockRecipe } from '@/shared/testing/mock-recipe.store.js';
import {
  SessionNotActiveError,
  RecipeHasNoStepsError,
  AtomNotFoundError,
} from '@/features/recipe/domain/errors/session.errors.js';

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
import type { AdvisoryLockManager } from '@/features/session/domain/ports/advisory-lock.port.js';
import { createSessionLockId } from '@/features/session/domain/ports/advisory-lock.port.js';
import {
  type PedagogicalState,
  type StateEventType,
  isTransitionAllowed,
  getNextState,
} from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';
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
import { evaluateMCQ } from '@/features/recipe/application/services/mcq-evaluation.service.js';
import { detectNavigationInput } from '@/features/recipe/application/services/navigation.service.js';
import type { LessonEvaluatorUseCase } from '@/features/evaluation/application/services/lesson.evaluator.js';
import type { FeatureFlagService } from '@/shared/config/evaluation-flags.js';
import type { RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';

// Phase 4 split: extracted collaborators (see same folder services/)
import {
  type RAGChunk,
  extractText,
  isQuestionScript,
  isActivityScript,
  readScriptOptions,
  requiresStudentInput,
  buildContentSteps,
  findPreviousContentStep,
  extractStaticContent as mapStaticContent,
  buildVoiceText as mapVoiceText,
  type QuestionScript,
  type ActivityScript,
} from '@/features/recipe/application/services/step-script.mapper.js';
import { withTimeout } from '@/features/recipe/application/services/llm-stream-timeout.js';
import { AnswerEvaluationService } from '@/features/recipe/application/services/answer-evaluation.service.js';
import { LessonCompletionService } from '@/features/recipe/application/services/lesson-completion.service.js';

// ─────────────────────────────────────────────────────────────────────────────

export class OrchestrateRecipeUseCase {
  private config: RecipeConfig = DEFAULT_CONFIG;

  private readonly answerEvaluation: AnswerEvaluationService;
  private readonly lessonCompletion: LessonCompletionService;

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
    comprehensionEvaluator: ComprehensionEvaluator,
    lessonEvaluator: LessonEvaluatorUseCase,
    private advisoryLockManager?: AdvisoryLockManager,
    private contextWindowService: ContextWindowService = new ContextWindowService(),
    featureFlagService?: FeatureFlagService,
    activityAttemptRepo?: ActivityAttemptRepository,
  ) {
    // Mantenidos para compatibilidad futura
    void this.conceptRepo;
    void this.activityRepo;

    // Phase 4 split: collaborators extracted into dedicated services
    this.answerEvaluation = new AnswerEvaluationService(
      userRepo,
      comprehensionEvaluator,
      lessonEvaluator,
      featureFlagService,
    );
    this.lessonCompletion = new LessonCompletionService(activityAttemptRepo);
  } // ─── Content mapping (delegated to step-script.mapper) ───────────────────
  private extractStaticContent(step: {
    stepType?: string | null;
    script?: unknown;
  }): StaticContent | undefined {
    return mapStaticContent(step);
  }

  private buildVoiceText(step: { stepType?: string | null; script?: unknown }): string {
    return mapVoiceText(step);
  }

  // ─── Helpers de clasificación de paso ───────────────────────────────────

  /**
   * Determine the pedagogical event based on evaluation result.
   * This maps evaluation outcomes to state machine events.
   */
  private getEventForEvaluation(
    evaluationResult: 'correct' | 'partial' | 'incorrect',
    currentState: PedagogicalState,
    _failedAttempts: number,
  ): StateEventType {
    // Map evaluation results to events based on current state
    if (currentState === 'ACTIVITY_WAIT' || currentState === 'ACTIVITY_INACTIVITY_WARNING') {
      switch (evaluationResult) {
        case 'correct':
          return 'EVALUATE_CORRECT';
        case 'partial':
          return 'EVALUATE_INCORRECT'; // Partial stays in ACTIVITY_WAIT
        case 'incorrect':
          // Check if should offer skip
          return 'EVALUATE_INCORRECT'; // Will transition based on failedAttempts in next step
      }
    }

    if (currentState === 'QUESTION') {
      switch (evaluationResult) {
        case 'correct':
          return 'EVALUATE_CORRECT';
        case 'partial':
        case 'incorrect':
          return 'EVALUATE_INCORRECT';
      }
    }

    // Default fallback
    return evaluationResult === 'correct' ? 'EVALUATE_CORRECT' : 'EVALUATE_INCORRECT';
  }

  /**
   * Apply state machine transition with validation.
   * Returns the new state based on the event, or current state if invalid.
   */
  private applyStateTransition(
    currentState: PedagogicalState,
    event: StateEventType,
  ): PedagogicalState {
    if (isTransitionAllowed(currentState, event)) {
      return getNextState(currentState, { type: event });
    }
    // Invalid transition - stay in current state
    orchestrateLogger.warn(
      { currentState, event, allowed: isTransitionAllowed(currentState, event) },
      '[OrchestrateRecipe] Invalid transition attempted, staying in current state',
    );
    return currentState;
  }

  private requiresStudentInput(stepType?: string | null): boolean {
    return requiresStudentInput(stepType);
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
    return buildContentSteps(steps);
  }

  private findPreviousContentStep(steps: readonly RecipeStep[], from: number): number | null {
    return findPreviousContentStep(steps, from);
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

  // ─── Answer evaluation (delegated to AnswerEvaluationService) ────────────
  private async evaluateAnswer(params: {
    script: QuestionScript;
    studentInput: string;
    attemptNumber: number;
    recipeTitle: string;
    stepIndex: number;
    studentId?: string;
  }): Promise<ComprehensionEvaluation> {
    return this.answerEvaluation.evaluateAnswer(params);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  async start(recipeId: string, studentId: string) {
    // Check if this is a mock recipe ID (used in E2E tests)
    const isMockRecipe = isMockRecipeId(recipeId);
    let recipe;

    if (isMockRecipe) {
      // Use the mock recipe stored in the in-memory store (set via /mock/recipe endpoint)
      recipe = getMockRecipe(recipeId);
      orchestrateLogger.info(`[MOCK] Using mock recipe: ${recipeId}`);
      if (!recipe) {
        orchestrateLogger.error(`[MOCK] Mock recipe not found: ${recipeId}`);
        throw new RecipeNotFoundError(recipeId);
      }
    } else {
      // Normal flow: fetch from repository
      recipe = await this.recipeRepo.findById(recipeId);
      if (!recipe) throw new RecipeNotFoundError(recipeId);
    }

    this.config = parseRecipeConfig(recipe.meta);
    const student = await this.userRepo.findById(studentId);
    const name = student?.name ?? 'estudiante';

    const steps = await this.recipeRepo.findStepsByRecipeId(recipeId);
    if (!steps.length) throw new RecipeHasNoStepsError(recipeId);

    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);

    // Check if this is a fresh reset: ACTIVE + AWAITING_START + step 0 = treat as terminal
    // (status becomes ACTIVE after resetSession use case calls updateStatus)
    const isFreshReset =
      existing &&
      existing.status === 'ACTIVE' &&
      existing.stateCheckpoint.currentState === 'AWAITING_START' &&
      (existing.stateCheckpoint.currentStepIndex ?? 0) === 0;

    // Case 1: Active session exists (and not a fresh reset) → resume it
    if (existing && !isTerminalStatus(existing.status) && !isFreshReset) {
      const rawIdx = existing.stateCheckpoint.currentStepIndex ?? 0;
      // Clamp the resumed index: a checkpoint pointing past the last step
      // (e.g. after recipe edits) must not crash static-content extraction.
      const clampedIdx = Math.min(Math.max(rawIdx, 0), steps.length - 1);
      const needsToStart = existing.stateCheckpoint.currentState === 'AWAITING_START';
      // A session that never started resumes at step 0 with the intro greeting.
      const resumeIdx = needsToStart ? 0 : clampedIdx;
      const resumeStep = steps[resumeIdx];
      // Voice text comes from the resumed step itself so the client can speak
      // real content; fall back to a generic greeting only when the step
      // carries no speakable text.
      const resumeVoiceText = this.buildVoiceText(resumeStep);
      const voiceText =
        resumeVoiceText ||
        (needsToStart
          ? fillTemplate(this.config.greetings.intro, {
              name,
              tutor: this.config.tutorName,
              title: recipe.title,
            })
          : `¡Bienvenido de vuelta, ${name}! Continuemos con ${recipe.title}.`);

      const stepRequiresInput = this.requiresStudentInput(resumeStep?.stepType);
      return {
        sessionId: existing.id,
        voiceText,
        pedagogicalState: (needsToStart
          ? 'AWAITING_START'
          : existing.stateCheckpoint.currentState) as PedagogicalState,
        staticContent: this.extractStaticContent(resumeStep),
        config: this.config as unknown as Record<string, unknown>,
        resumed: true,
        needsStart: needsToStart,
        lessonProgress: { currentStep: resumeIdx, totalSteps: steps.length },
        contentSteps: this.buildContentSteps(steps),
        autoAdvance: needsToStart ? false : !stepRequiresInput, // Auto-advance if not needsStart and step doesn't require input
      };
    }

    // Case 2: Completed/Escalated session exists OR fresh reset → reuse it (reset instead of creating new)
    if (existing && (isTerminalStatus(existing.status) || isFreshReset)) {
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
        autoAdvance: false, // AWAITING_START needs explicit input to advance
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
      autoAdvance: false, // AWAITING_START needs explicit input to advance
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
      throw new SessionNotActiveError(sessionId, session.status);

    // Check if this is a mock recipe ID (used in E2E tests)
    const isMockRecipe = isMockRecipeId(session.recipeId);
    let recipe;

    if (isMockRecipe) {
      // Use the mock recipe stored in the in-memory store (set via /mock/recipe endpoint)
      recipe = getMockRecipe(session.recipeId);
      if (!recipe) throw new RecipeNotFoundError(session.recipeId);
    } else {
      // Normal flow: fetch from repository
      recipe = await this.recipeRepo.findById(session.recipeId);
      if (!recipe) throw new RecipeNotFoundError(session.recipeId);
    }
    this.config = parseRecipeConfig(recipe.meta);

    const steps = isMockRecipe
      ? recipe.steps
      : await this.recipeRepo.findStepsByRecipeId(session.recipeId);
    if (!steps.length) throw new RecipeHasNoStepsError(session.recipeId);

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
      await this.lessonCompletion.emitLessonCompleted(
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
    if (!currentAtom) throw new AtomNotFoundError(currentStep.atomId, currentIdx);

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
          autoAdvance: !this.requiresStudentInput(currentStep.stepType), // Auto-advance for content steps
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
    const { isNavigation } = detectNavigationInput(studentInput, currentState);

    // Navigation fast path: detectNavigationInput already blocks ACTIVITY_WAIT, RESOLVING_DOUBT, CLARIFYING
    if (isNavigation) {
      const navNextIdx = this.advanceStep(steps, currentIdx);
      if (navNextIdx === null) {
        // No more steps — complete the lesson
        await this.sessionRepo.complete(sessionId);
        await this.lessonCompletion.emitLessonCompleted(
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
          autoAdvance: false, // User must answer the question
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
          autoAdvance: false, // User must complete the activity
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
        autoAdvance: !this.requiresStudentInput(nextStep.stepType), // Auto-advance for content steps
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
      // AUTO-ADVANCE: For content steps (intro, content, closure), automatically advance
      // to the next step without requiring user input
      const currentStepRequiresInput = this.requiresStudentInput(currentStep.stepType);

      if (!currentStepRequiresInput && action.type !== 'ACCEPT') {
        // Content step: auto-advance automatically
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = this.applyStateTransition(currentState, 'COMPLETE');
        } else {
          nextIdx = adv;
          nextState = this.applyStateTransition(currentState, 'AUTO_ADVANCE');
          // Override to step type state for content/activity steps
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      } else if (action.type === 'ACCEPT' && classification.intent === 'question' && canAsk()) {
        questionCount++;
        lastQuestionTime = new Date().toISOString();
        nextState = this.applyStateTransition(currentState, 'RAISE_HAND');
        savedStepIndex = currentIdx;
        doubtContext = { question: studentInput, stepIndex: currentIdx };
      } else if (action.type === 'ACCEPT' && classification.intent === 'question') {
        voiceText = 'Continuemos con el tema por ahora.';
        nextState = currentState;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = this.applyStateTransition(currentState, 'COMPLETE');
        } else {
          nextIdx = adv;
          nextState = this.applyStateTransition(currentState, 'ADVANCE');
          // Override to step type state for content/activity steps
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'ACTIVITY_WAIT') {
      const script: unknown = currentStep.script;
      const stepType = currentStep.stepType as string;

      orchestrateLogger.info(
        {
          stepIndex: currentIdx,
          stepType,
          studentInput,
          scriptHasOptions: readScriptOptions(script).length > 0,
          scriptOptionsLength: readScriptOptions(script).length,
        },
        '[ACTIVITY_WAIT] Processing student input',
      );

      // PRIORITY: Use stepType to determine evaluation method
      // - 'question' steps use LLM (free response)
      // - 'activity'/'exam' steps use deterministic comparison (MCQ)
      if (stepType === 'question' || stepType === 'QUESTION') {
        orchestrateLogger.info('[BUG] QUESTION at 1471 - calling evaluateAnswer');
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
        // Determine event based on evaluation result
        const evalEvent = this.getEventForEvaluation(
          evaluation.result,
          'ACTIVITY_WAIT',
          failedAttempts,
        );

        if (evaluation.result === 'correct') {
          voiceText = qs.feedback.correct;
          responseFeedback = qs.feedback.correct;
          isCorrectValue = true;
          // Use state machine to determine next state
          nextState = this.applyStateTransition('ACTIVITY_WAIT', evalEvent);
          failedAttempts = 0;
        } else if (evaluation.result === 'partial') {
          voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
          isCorrectValue = false;
          // For partial, stay in ACTIVITY_WAIT
          nextState = this.applyStateTransition('ACTIVITY_WAIT', 'EVALUATE_INCORRECT');
        } else {
          failedAttempts++;
          totalWrongAnswers++;
          voiceText = qs.feedback.incorrect;
          responseFeedback = qs.feedback.incorrect;
          isCorrectValue = false;
          // Determine next state based on failed attempts
          const event =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_TIMEOUT'
              : 'EVALUATE_INCORRECT';
          nextState = this.applyStateTransition('ACTIVITY_WAIT', event);
        }
      } else if (
        stepType === 'activity' ||
        stepType === 'exam' ||
        stepType === 'ACTIVITY' ||
        stepType === 'EXAM'
      ) {
        if (!script) {
          orchestrateLogger.error(
            { stepIndex: currentIdx, stepType },
            '[ACTIVITY_WAIT] Script is null for activity/exam step',
          );
          return {
            voiceText: 'Error: Activity script not found. Please contact support.',
            pedagogicalState: 'ACTIVITY_WAIT' as PedagogicalState,
            staticContent: this.extractStaticContent(currentStep),
            lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
          };
        }
        const as = script as ActivityScript;
        const mcqResult = evaluateMCQ(as, studentInput, {
          stepIndex: currentIdx,
          stateName: 'ACTIVITY_WAIT_interact',
        });
        const isCorrect = mcqResult.isCorrect;

        voiceText = mcqResult.feedback;
        responseFeedback = voiceText;
        isCorrectValue = isCorrect;

        if (isCorrect) {
          nextState = this.applyStateTransition('ACTIVITY_WAIT', 'EVALUATE_CORRECT');
          failedAttempts = 0;
        } else {
          failedAttempts++;
          totalWrongAnswers++;
          // Determine next state based on failed attempts
          const event =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_TIMEOUT'
              : 'EVALUATE_INCORRECT';
          nextState = this.applyStateTransition('ACTIVITY_WAIT', event);
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
          nextState = this.applyStateTransition('EVALUATION', 'COMPLETE');
        } else {
          nextIdx = adv;
          nextState = this.applyStateTransition('EVALUATION', 'ADVANCE');
          // Determine target state based on step type
          if (nextState === 'EXPLANATION') {
            nextState = this.stateForStep(steps[nextIdx]);
          }
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
            nextState = this.applyStateTransition('EVALUATION', 'EVALUATE_CORRECT');
            failedAttempts = 0;
          } else if (evaluation.result === 'partial') {
            voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
            isCorrectValue = false;
            nextState = this.applyStateTransition('EVALUATION', 'EVALUATE_PARTIAL');
          } else {
            failedAttempts++;
            totalWrongAnswers++;
            voiceText = qs.feedback.incorrect;
            responseFeedback = qs.feedback.incorrect;
            isCorrectValue = false;
            const evalEvent =
              failedAttempts >= this.config.skipAfterFailedAttempts &&
              this.config.enableActivitySkip
                ? 'OFFER_SKIP'
                : 'EVALUATE_INCORRECT';
            nextState = this.applyStateTransition('EVALUATION', evalEvent);
          }
        } else if (isActivityScript(script)) {
          if (!script) {
            orchestrateLogger.error(
              { stepIndex: currentIdx },
              '[EVALUATION] Script is null for activity/exam step',
            );
            return {
              voiceText: 'Error: Activity script not found. Please contact support.',
              pedagogicalState: 'EVALUATION' as PedagogicalState,
              staticContent: this.extractStaticContent(currentStep),
              lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
            };
          }
          const as = script as ActivityScript;
          const mcqResult = evaluateMCQ(as, studentInput, {
            stepIndex: currentIdx,
            stateName: 'EVALUATION_interact',
          });
          const isCorrect = mcqResult.isCorrect;
          voiceText = mcqResult.feedback;
          responseFeedback = voiceText;
          isCorrectValue = isCorrect;
          if (isCorrect) {
            nextState = this.applyStateTransition('EVALUATION', 'EVALUATE_CORRECT');
            failedAttempts = 0;
          } else {
            failedAttempts++;
            totalWrongAnswers++;
            const evalEvent =
              failedAttempts >= this.config.skipAfterFailedAttempts &&
              this.config.enableActivitySkip
                ? 'OFFER_SKIP'
                : 'EVALUATE_INCORRECT';
            nextState = this.applyStateTransition('EVALUATION', evalEvent);
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
        await this.lessonCompletion.emitLessonCompleted(
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
      const accuracy = await this.lessonCompletion.calculateAccuracy(
        session.studentId,
        steps,
        skippedActivities,
      );
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
      autoAdvance: !this.requiresStudentInput(currentStep.stepType), // Auto-advance for content steps
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
    // Allow both ACTIVE and IDLE status - IDLE sessions can still interact
    if (session.status !== 'ACTIVE' && session.status !== 'IDLE')
      throw new SessionNotActiveError(sessionId, session.status);

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
    if (!steps.length) throw new RecipeHasNoStepsError(session.recipeId);

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
        autoAdvance: false,
      };
      return;
    }

    const currentStep = steps[currentIdx];
    if (!currentStep) {
      await this.sessionRepo.complete(sessionId);
      await this.lessonCompletion.emitLessonCompleted(
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
    if (!currentAtom) throw new AtomNotFoundError(currentStep.atomId, currentIdx);

    // ── ACTIVITY_WAIT fast path (no streaming needed) ────────────────────────
    // Skip LLM calls and use deterministic MCQ evaluation for activity steps
    if (currentState === 'ACTIVITY_WAIT') {
      const script: unknown = currentStep.script;
      const stepType = currentStep.stepType as string;

      orchestrateLogger.info(
        {
          stepIndex: currentIdx,
          stepType,
          studentInput,
          scriptKeys: script !== null && typeof script === 'object' ? Object.keys(script) : [],
          hasOptions: readScriptOptions(script).length > 0,
          options: readScriptOptions(script),
        },
        '[interactStream] ACTIVITY_WAIT - processing answer',
      );

      if (
        stepType === 'activity' ||
        stepType === 'exam' ||
        stepType === 'ACTIVITY' ||
        stepType === 'EXAM'
      ) {
        if (!script) {
          orchestrateLogger.error(
            { stepIndex: currentIdx, stepType },
            '[interactStream] Script is null for activity/exam step',
          );
          yield {
            type: 'end' as const,
            reason: 'completed' as const,
            pedagogicalState: 'ACTIVITY_WAIT' as PedagogicalState,
            sessionCompleted: false,
            staticContent: this.extractStaticContent(currentStep),
            lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
            autoAdvance: false,
          };
          return;
        }
        // MCQ: deterministic comparison (NO LLM)
        const as = script as ActivityScript;
        const mcqResult = evaluateMCQ(as, studentInput, {
          stepIndex: currentIdx,
          stateName: 'ACTIVITY_WAIT_fast',
        });
        const { isCorrect, feedback } = mcqResult;

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
          autoAdvance: false, // Wait for user to continue
        };
        return;
      } else if (stepType === 'question' || stepType === 'QUESTION') {
        // QUESTION: response already generated above via generateResponseStream
        // The main state machine at line 2308 will handle this
        orchestrateLogger.info('[QUESTION] Step type detected, will handle in main state machine');
        // Don't return here - let it fall through to main state machine
      }
    }

    // Main state machine handles all states including QUESTION in ACTIVITY_WAIT
    if (currentState === 'AWAITING_START') {
      // ── AWAITING_START fast path (no streaming needed) ──────────────────────
      const lower = studentInput.toLowerCase();
      orchestrateLogger.info(
        { studentInput, lower, currentIdx, stepType: currentStep.stepType },
        '[interactStream] AWAITING_START - checking if input triggers start',
      );
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
        orchestrateLogger.info(
          {
            ready,
            currentIdx,
            stepType: currentStep.stepType,
            stateForStep: this.stateForStep(currentStep),
          },
          '[interactStream] AWAITING_START - matched ready input, will transition',
        );
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
          autoAdvance: !this.requiresStudentInput(currentStep.stepType),
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
        autoAdvance: false, // Wait for user to confirm
      };
      return;
    }

    // ── Navigation Fast Path (streaming) ─────────────────────────────────
    // Skip LLM calls for simple navigation inputs. Use static content only.
    const { isNavigation } = detectNavigationInput(studentInput, currentState);

    if (isNavigation) {
      const navNextIdx = this.advanceStep(steps, currentIdx);
      if (navNextIdx === null) {
        await this.sessionRepo.complete(sessionId);
        await this.lessonCompletion.emitLessonCompleted(
          session.studentId,
          session.recipeId,
          recipe.title,
          steps,
          skippedActivities,
        );

        let xpEarned: number | undefined;
        let accuracyData: InteractRecipeOutput['accuracy'] = undefined;
        if (session.studentId) {
          const accuracy = await this.lessonCompletion.calculateAccuracy(
            session.studentId,
            steps,
            skippedActivities,
          );
          const { calculateXPFromAccuracy } =
            await import('@/features/gamification/application/strategies/xp-reward.strategy.js');
          xpEarned = calculateXPFromAccuracy(accuracy.accuracyPercent);
          accuracyData = accuracy;
        }

        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: 'COMPLETED',
          sessionCompleted: true,
          staticContent: this.extractStaticContent(currentStep),
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
          xpEarned,
          accuracy: accuracyData,
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
          autoAdvance: false, // User must answer the question
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
          autoAdvance: false, // User must complete the activity
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
        autoAdvance: !this.requiresStudentInput(nextStep.stepType), // Auto-advance for content steps
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
      const timedStream = withTimeout(this.aiService.generateResponseStream(params));
      for await (const chunk of timedStream) {
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
      if (!fullResponse) {
        fullResponse = this.getFallbackResponse(currentState, currentAtom.title).explanation;
        yield { type: 'chunk', text: fullResponse };
      }
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
      // AUTO-ADVANCE: For content steps (intro, content, closure), automatically advance
      // to the next step without requiring user input
      const currentStepRequiresInput = this.requiresStudentInput(currentStep.stepType);

      if (!currentStepRequiresInput && action.type !== 'ACCEPT') {
        // Content step: auto-advance automatically
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = this.applyStateTransition(currentState, 'COMPLETE');
        } else {
          nextIdx = adv;
          nextState = this.applyStateTransition(currentState, 'AUTO_ADVANCE');
          // Override to step type state for content/activity steps
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      } else if (action.type === 'ACCEPT' && classification.intent === 'question' && canAsk()) {
        questionCount++;
        lastQuestionTime = new Date().toISOString();
        nextState = this.applyStateTransition(currentState, 'RAISE_HAND');
        savedStepIndex = currentIdx;
        doubtContext = { question: studentInput, stepIndex: currentIdx };
      } else if (action.type === 'ACCEPT' && classification.intent === 'question') {
        voiceText = 'Continuemos con el tema por ahora.';
        nextState = currentState;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = this.applyStateTransition(currentState, 'COMPLETE');
        } else {
          nextIdx = adv;
          nextState = this.applyStateTransition(currentState, 'ADVANCE');
          // Override to step type state for content/activity steps
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'ACTIVITY_WAIT') {
      const script: unknown = currentStep.script;
      const stepType = currentStep.stepType as string;

      // QUESTION: free response - response already generated above, just advance
      // ACTIVITY/EXAM: evaluate with MCQ
      if (stepType === 'question' || stepType === 'QUESTION') {
        orchestrateLogger.info('[FIXED] QUESTION at 2291 - skipping evaluateAnswer');
        nextState = 'EVALUATION';
      } else if (
        stepType === 'activity' ||
        stepType === 'exam' ||
        stepType === 'ACTIVITY' ||
        stepType === 'EXAM'
      ) {
        if (!script) {
          orchestrateLogger.error(
            { stepIndex: currentIdx, stepType },
            '[stream] Script is null for activity/exam step',
          );
          yield {
            type: 'end' as const,
            reason: 'completed' as const,
            pedagogicalState: 'ACTIVITY_WAIT' as PedagogicalState,
            sessionCompleted: false,
            staticContent: this.extractStaticContent(currentStep),
            lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
            autoAdvance: false,
          };
          return;
        }
        const as = script as ActivityScript;
        const mcqResult = evaluateMCQ(as, studentInput, {
          stepIndex: currentIdx,
          stateName: 'ACTIVITY_WAIT',
        });
        const isCorrect = mcqResult.isCorrect;

        voiceText = mcqResult.feedback;

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
          if (!script) {
            orchestrateLogger.error(
              { stepIndex: currentIdx },
              '[stream] Script is null for activity/exam step',
            );
            yield {
              type: 'end' as const,
              reason: 'completed' as const,
              pedagogicalState: 'EVALUATION' as PedagogicalState,
              sessionCompleted: false,
              staticContent: this.extractStaticContent(currentStep),
              lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
              autoAdvance: false,
            };
            return;
          }
          const as = script as ActivityScript;
          const mcqResult = evaluateMCQ(as, studentInput, {
            stepIndex: currentIdx,
            stateName: 'EVALUATION',
          });
          const isCorrect = mcqResult.isCorrect;
          voiceText = mcqResult.feedback;

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
        await this.lessonCompletion.emitLessonCompleted(
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

    // Calculate accuracy and XP for completed lessons
    let xpEarned: number | undefined;
    let accuracyData: InteractRecipeOutput['accuracy'] = undefined;
    if (willComplete && session.studentId) {
      const accuracy = await this.lessonCompletion.calculateAccuracy(
        session.studentId,
        steps,
        skippedActivities,
      );
      const { calculateXPFromAccuracy } =
        await import('@/features/gamification/application/strategies/xp-reward.strategy.js');
      xpEarned = calculateXPFromAccuracy(accuracy.accuracyPercent);
      accuracyData = accuracy;
    }

    // Debug: confirm we're reaching the final yield
    orchestrateLogger.info(
      {
        nextState,
        nextIdx,
        willComplete,
        fullResponseLength: fullResponse?.length ?? 0,
      },
      '[FINAL] Sending end event for QUESTION step',
    );

    yield {
      type: 'end',
      reason: 'completed',
      pedagogicalState: nextState,
      sessionCompleted: willComplete,
      staticContent: this.extractStaticContent(steps[nextIdx] ?? currentStep),
      lessonProgress: { currentStep: nextIdx, totalSteps: steps.length },
      autoAdvance: !this.requiresStudentInput(currentStep.stepType),
      xpEarned,
      accuracy: accuracyData,
    };
  }
}
