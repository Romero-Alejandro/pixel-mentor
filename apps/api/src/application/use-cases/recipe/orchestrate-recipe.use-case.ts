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
} from '@/domain/ports/question-classifier.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import type { AdvisoryLockManager } from '@/domain/ports/advisory-lock.js';
import { createSessionLockId } from '@/domain/ports/advisory-lock.js';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state.js';
import type { Interaction } from '@/domain/entities/interaction.js';
import { getNextState, isTransitionAllowed } from '@/domain/state/state-machine.js';
import type { StateEvent } from '@/domain/state/state-machine.js';
import type { SessionCheckpoint } from '@/domain/entities/session.js';
import type { InteractRecipeOutput, StaticContent } from '@/application/dto/index.js';
import { determineClassificationAction } from '@/domain/entities/question-classification.js';
import { ContextWindowService } from '@/application/services/context-window.service.js';
import {
  parseRecipeConfig,
  fillTemplate,
  DEFAULT_CONFIG,
  type RecipeConfig,
} from '@/domain/entities/recipe-config.js';
import { isTerminalStatus } from '@/domain/entities/session.js';

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
    private advisoryLockManager?: AdvisoryLockManager,
    private contextWindowService: ContextWindowService = new ContextWindowService(),
  ) {
    // Keep these for future use: concept-based content loading
    void this.conceptRepo;
  }

  /**
   * Extract static content from a recipe step
   */
  private async extractStaticContent(step: {
    stepType?: string;
    script?: any;
    activityId?: string;
  }): Promise<StaticContent | undefined> {
    if (!step.stepType) return undefined;

    const staticContent: StaticContent = {
      stepType: step.stepType as 'content' | 'activity' | 'intro' | 'closure',
    };

    // Add script content if available
    if (step.script) {
      staticContent.script = {
        transition: step.script.transition || '',
        content: step.script.content || '',
        examples: step.script.examples || [],
        closure: step.script.closure || '',
      };
    }

    // Add activity content if available
    if (step.activityId) {
      const activity = await this.activityRepo.findById(step.activityId);
      if (activity) {
        staticContent.activity = {
          instruction: activity.instruction,
          options: activity.options
            ? activity.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
            : undefined,
          feedback: {
            correct: activity.feedback.correct,
            incorrect: activity.feedback.incorrect,
            partial: activity.feedback.partial,
          },
        };
      }
    }

    return staticContent;
  }

  async start(
    recipeId: string,
    studentId: string,
  ): Promise<{
    sessionId: string;
    voiceText: string;
    pedagogicalState: PedagogicalState;
    staticContent?: StaticContent;
    config?: Record<string, unknown>;
    resumed?: boolean;
    needsStart?: boolean;
  }> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    // Parse recipe configuration from meta
    this.config = parseRecipeConfig(recipe.meta);

    // Get student name for personalized greeting
    const student = await this.userRepo.findById(studentId);
    const studentName = student?.name || 'estudiante';

    const steps = await this.recipeRepo.findStepsByRecipeId(recipeId);
    if (steps.length === 0) {
      throw new Error('Recipe has no steps');
    }

    const firstStep = steps[0];
    const firstAtom = await this.atomRepo.findById(firstStep.atomId);
    if (!firstAtom) {
      throw new Error(`Atom with ID ${firstStep.atomId} not found`);
    }

    // Check for existing non-terminal session
    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);
    if (existing && !isTerminalStatus(existing.status)) {
      // Resume: get the current step content for proper display
      const currentStepIndex = existing.stateCheckpoint.currentStepIndex ?? 0;
      const currentStep = steps[currentStepIndex] || steps[0];

      // Check if session needs to start (was in AWAITING_START)
      const needsToStart = existing.stateCheckpoint.currentState === 'AWAITING_START';

      // Build a resume message based on the current state
      const stateMessages: Record<string, string> = {
        ACTIVE_CLASS: `¡Bienvenido de vuelta! Vamos a continuar aprendiendo ${recipe.title}.`,
        QUESTION: 'Tenías una pregunta pendiente. ¿Querés que la respondamos?',
        EVALUATION: 'Tenías una actividad en progreso. Continuemos.',
        AWAITING_CONFIRMATION: 'Hay algo que necesita confirmación. ¿Querés continuar?',
        PAUSED_IDLE: `¡Hola de nuevo! Tu sesión estaba en pausa. Continuemos con ${recipe.title}.`,
        PAUSED_FOR_QUESTION: '¿Querés que retomemos donde lo dejamos?',
        IDLE: `¡Bienvenido de vuelta! Vamos a continuar con ${recipe.title}.`,
      };

      // If needs to start, use the intro message instead
      const resumeMessage = needsToStart
        ? fillTemplate(this.config.greetings.intro, {
            name: studentName,
            tutor: this.config.tutorName,
            title: recipe.title,
          })
        : stateMessages[existing.stateCheckpoint.currentState] ||
          `¡Bienvenido de vuelta! Continuemos con tu aprendizaje.`;

      // Extract static content if there's a current step
      let staticContent: StaticContent | undefined;
      if (currentStep) {
        staticContent = await this.extractStaticContent(currentStep);
      }

      // Return state that indicates user needs to click "Comenzar"
      return {
        sessionId: existing.id,
        voiceText: resumeMessage,
        // Return needsStart flag to trigger the "Comenzar" button on frontend
        pedagogicalState: needsToStart
          ? 'AWAITING_START'
          : (existing.stateCheckpoint.currentState as PedagogicalState),
        staticContent,
        config: this.config as unknown as Record<string, unknown>,
        resumed: true,
        needsStart: needsToStart,
      };
    }

    const sessionId = randomUUID();

    // Create presentation greeting using config
    const introGreeting = fillTemplate(this.config.greetings.intro, {
      name: studentName,
      tutor: this.config.tutorName,
      title: recipe.title,
    });

    const readyPrompt = fillTemplate(this.config.greetings.readyPrompt, {
      name: studentName,
      tutor: this.config.tutorName,
      title: recipe.title,
    });

    const voiceText = `${introGreeting}. ${readyPrompt}`;

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
      },
    });

    // Create initial interaction
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: 1,
      transcript: voiceText,
      aiResponse: {
        text: voiceText,
        responseType: 'greeting',
      },
      pausedForQuestion: false,
    });

    await this.sessionRepo.updateStatus(sessionId, 'ACTIVE');

    // Extract static content from the first step
    const staticContent = await this.extractStaticContent(firstStep);

    return {
      sessionId,
      voiceText,
      pedagogicalState: 'AWAITING_START',
      staticContent,
      config: this.config as unknown as Record<string, unknown>,
      resumed: false,
    };
  }

  async interact(
    sessionId: string,
    studentInput: string,
    userId?: string,
  ): Promise<InteractRecipeOutput> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (userId && session.studentId !== userId) {
      const error = new Error('Forbidden: access denied');
      // Using a generic approach for HTTP status codes
      // In a real implementation, you might want to use a custom HttpError class
      throw error;
    }
    if (session.status !== 'ACTIVE') {
      throw new Error(`Session is not active (status: ${session.status})`);
    }

    const recipe = await this.recipeRepo.findById(session.recipeId);
    if (!recipe) throw new RecipeNotFoundError(session.recipeId);

    const steps = await this.recipeRepo.findStepsByRecipeId(session.recipeId);
    if (steps.length === 0) {
      throw new Error('Recipe has no steps');
    }

    const history = await this.interactionRepo.findBySessionOrdered(sessionId);
    const limitedHistory = this.contextWindowService.trimHistory(history);
    const recentHistory: Array<{ readonly role: 'user' | 'assistant'; readonly content: string }> =
      limitedHistory.map((h: Interaction) => ({
        role: h.turnNumber % 2 === 1 ? ('user' as const) : ('assistant' as const),
        content: h.transcript,
      }));
    const historySummary = this.contextWindowService.summarizeOlderTurns(history);

    const checkpoint = session.stateCheckpoint;
    const currentState = checkpoint.currentState;
    const currentStepIndex = checkpoint.currentStepIndex;
    let newStepIndex = currentStepIndex;
    let newSavedStepIndex: number | undefined = checkpoint.savedStepIndex;
    let newDoubtContext: { question: string; stepIndex: number } | undefined =
      checkpoint.doubtContext;

    // Mutable checkpoint tracking
    let questionCount = checkpoint.questionCount || 0;
    let lastQuestionTime = checkpoint.lastQuestionTime;
    let skippedActivities = checkpoint.skippedActivities || [];
    let failedAttempts = checkpoint.failedAttempts || 0;

    // Check for escalation flags pre-AI
    if (session.safetyFlag || session.outOfScope) {
      await this.sessionRepo.escalate(sessionId);
      return {
        voiceText: 'Session escalated',
        pedagogicalState: currentState,
        sessionCompleted: true,
        feedback: 'Session escalated due to safety or repeated failures',
      };
    }

    // Get current step and atom
    const currentStep = steps[newStepIndex];
    const currentAtom = await this.atomRepo.findById(currentStep.atomId);
    if (!currentAtom) {
      throw new Error(`Atom with ID ${currentStep.atomId} not found`);
    }

    // FAST PATH: AWAITING_START state doesn't need AI - just check for start keywords
    if (currentState === 'AWAITING_START') {
      const lowerInput = studentInput.toLowerCase();
      if (
        lowerInput.includes('sí') ||
        lowerInput.includes('si') ||
        lowerInput.includes('start') ||
        lowerInput.includes('comenzar') ||
        lowerInput.includes('listo') ||
        lowerInput.includes('ready') ||
        lowerInput.includes('adelante') ||
        lowerInput.includes('vamos')
      ) {
        // Update checkpoint directly without AI calls
        const updatedCheckpoint: SessionCheckpoint = {
          ...checkpoint,
          currentState: 'ACTIVE_CLASS' as PedagogicalState,
        };

        await this.interactionRepo.create({
          id: randomUUID(),
          sessionId,
          turnNumber: history.length + 1,
          transcript: studentInput,
          aiResponse: null,
          pausedForQuestion: false,
        });

        const voiceText = '¡Perfecto! Vamos a comenzar.';

        await this.interactionRepo.create({
          id: randomUUID(),
          sessionId,
          turnNumber: history.length + 2,
          transcript: voiceText,
          aiResponse: { text: voiceText, responseType: 'answer' },
          pausedForQuestion: false,
        });

        await this.sessionRepo.updateCheckpoint(sessionId, updatedCheckpoint);

        const staticContent = await this.extractStaticContent(currentStep);

        return {
          voiceText,
          pedagogicalState: 'ACTIVE_CLASS',
          staticContent,
        };
      } else {
        // Keep waiting - return the ready prompt
        const voiceText = this.config.greetings.readyPrompt;

        await this.interactionRepo.create({
          id: randomUUID(),
          sessionId,
          turnNumber: history.length + 1,
          transcript: studentInput,
          aiResponse: null,
          pausedForQuestion: false,
        });

        await this.interactionRepo.create({
          id: randomUUID(),
          sessionId,
          turnNumber: history.length + 2,
          transcript: voiceText,
          aiResponse: { text: voiceText, responseType: 'answer' },
          pausedForQuestion: false,
        });

        const staticContent = await this.extractStaticContent(currentStep);

        return {
          voiceText,
          pedagogicalState: 'AWAITING_START',
          staticContent,
        };
      }
    }

    // Classify student input
    const classification = await this.questionClassifier.classify({
      transcript: studentInput,
      lastTurns: recentHistory,
      lessonMetadata: {
        title: recipe.title,
        concepts: [],
      },
    });

    const action = determineClassificationAction(classification);

    // Determine if we need RAG context
    let ragContext;
    if (action.type === 'ACCEPT' && classification.intent === 'question') {
      const retrieval = await this.ragService.retrieveChunks({
        atomId: currentAtom.id,
        queryText: studentInput,
        k: 3,
      });
      ragContext = retrieval.chunks;
    }

    // Prepare currentQuestion if atom is a quiz type
    let currentQuestion: { text: string; options?: readonly string[] } | undefined;
    if (['MINI_QUIZ', 'MCQ', 'INTERACTIVE'].includes(currentAtom.type)) {
      const options = currentAtom.options?.map((o) => o.text) ?? undefined;
      currentQuestion = {
        text: currentAtom.title,
        options,
      };
    }

    const aiResponse: AIResponse = await this.aiService.generateResponse({
      recipe,
      currentState,
      conversationHistory: recentHistory,
      currentQuestion,
      ragContext,
      currentSegment: {
        chunkText: currentAtom.content || currentAtom.title,
        order: currentStep.order,
      },
      totalSegments: steps.length,
      historySummary,
    });

    let voiceText =
      aiResponse.explanation +
      (aiResponse.microInteraction ? '\n' + aiResponse.microInteraction.text : '');

    let responseFeedback = aiResponse.feedback;
    let nextState: PedagogicalState;
    let event: StateEvent | null = null;
    let shouldAdvanceStep = false;
    let willComplete = false;

    // Helper to check cooldown between questions
    const canAskQuestion = (): boolean => {
      // Check max questions limit
      if (questionCount >= this.config.maxQuestionsPerSession) {
        return false;
      }

      // Check cooldown
      if (lastQuestionTime) {
        const timeSinceLastQuestion = Date.now() - new Date(lastQuestionTime).getTime();
        const cooldownMs = this.config.questionCooldownSeconds * 1000;
        if (timeSinceLastQuestion < cooldownMs) {
          return false;
        }
      }

      return true;
    };

    // State machine transitions
    if (currentState === 'ACTIVE_CLASS') {
      // Check if asking question and if cooldown applies
      const isQuestion = action.type === 'ACCEPT' && classification.intent === 'question';

      if (isQuestion && !canAskQuestion()) {
        // Return feedback about cooldown or limit
        if (questionCount >= this.config.maxQuestionsPerSession) {
          voiceText = `Hoy hemos hecho muchas preguntas. ¡Sigamos practicando las actividades!`;
        } else {
          voiceText = `Espera un momentito, vamos a practicar un poco primero. ¡Tú puedes!`;
        }
        nextState = 'ACTIVE_CLASS';
      } else if (isQuestion) {
        // Allow the question - increment counter
        questionCount += 1;
        lastQuestionTime = new Date().toISOString();
        event = { type: 'RAISE_HAND' };
      } else if (action.type === 'CLARIFY') {
        event = { type: 'CLARIFY' };
      } else {
        event = { type: 'CONTINUE' };
      }

      if (event && isTransitionAllowed(currentState, event.type)) {
        nextState = getNextState(currentState, event);
      } else if (!event) {
        nextState = currentState;
      } else {
        throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
      }

      if (nextState === 'RESOLVING_DOUBT') {
        newSavedStepIndex = currentStepIndex;
        newDoubtContext = { question: studentInput, stepIndex: currentStepIndex };
      }

      // CONTINUE advances to EXPLANATION
      if (event && event.type === 'CONTINUE') {
        if (newStepIndex < steps.length - 1) {
          shouldAdvanceStep = true;
          nextState = 'EXPLANATION';
        } else {
          nextState = 'COMPLETED';
          willComplete = true;
        }
      }
    } else if (currentState === 'EXPLANATION') {
      // Handle question during explanation
      if (action.type === 'ACCEPT' && classification.intent === 'question') {
        const isQuestionAllowed = canAskQuestion();

        if (!isQuestionAllowed) {
          voiceText = `Espera un poquito, vamos a practicar un poco después de la explicación.`;
          nextState = 'EXPLANATION';
        } else {
          questionCount += 1;
          lastQuestionTime = new Date().toISOString();
          event = { type: 'RAISE_HAND' };
          nextState = 'RESOLVING_DOUBT';
          newSavedStepIndex = currentStepIndex;
          newDoubtContext = { question: studentInput, stepIndex: currentStepIndex };
        }
      } else if (action.type === 'CLARIFY') {
        event = { type: 'CLARIFY' };
        nextState = 'CLARIFYING';
      } else {
        // Normal continuation - move to activity wait
        event = { type: 'EXPLAIN', conceptIndex: 0 };
        nextState = 'ACTIVITY_WAIT';
      }
    } else if (currentState === 'ACTIVITY_WAIT') {
      // Handle question during activity wait
      if (action.type === 'ACCEPT' && classification.intent === 'question') {
        const isQuestionAllowed = canAskQuestion();

        if (!isQuestionAllowed) {
          voiceText = `Vamos a terminar esta actividad primero.`;
          nextState = 'ACTIVITY_WAIT';
        } else {
          questionCount += 1;
          lastQuestionTime = new Date().toISOString();
          event = { type: 'RAISE_HAND' };
          nextState = 'RESOLVING_DOUBT';
          newSavedStepIndex = currentStepIndex;
          newDoubtContext = { question: studentInput, stepIndex: currentStepIndex };
        }
      } else {
        // Evaluate answer
        let expectedAnswer = '';
        if (currentAtom.type === 'MCQ' || currentAtom.type === 'MINI_QUIZ') {
          const correctOption = currentAtom.options?.find((o) => o.isCorrect);
          expectedAnswer = correctOption?.text || '';
        } else if (currentAtom.content) {
          expectedAnswer = currentAtom.content;
        }

        const evaluation = await this.comprehensionEvaluator.evaluate({
          microQuestion: currentAtom.title,
          expectedAnswer,
          studentAnswer: studentInput,
          attemptNumber: failedAttempts + 1,
        });

        if (evaluation.result === 'correct') {
          event = { type: 'ANSWER', answer: studentInput, isCorrect: true };
          nextState = 'EVALUATION';
        } else if (evaluation.result === 'partial') {
          nextState = 'ACTIVITY_WAIT';
          if (evaluation.hint) {
            responseFeedback = (responseFeedback ? responseFeedback + ' ' : '') + evaluation.hint;
          }
        } else {
          // Incorrect - check if we should offer skip
          const updatedSession = await this.sessionRepo.incrementFailedAttempts(sessionId);
          const failedAttempts = updatedSession.failedAttempts || 0;

          if (
            failedAttempts >= this.config.skipAfterFailedAttempts &&
            this.config.enableActivitySkip
          ) {
            event = { type: 'OFFER_SKIP', reason: 'failed_attempts' };
            nextState = 'ACTIVITY_SKIP_OFFER';
          } else {
            event = { type: 'ANSWER', answer: studentInput, isCorrect: false };
            nextState = 'EVALUATION';
          }
        }
      }
    } else if (currentState === 'QUESTION') {
      // Handle question during question state (allow doubts)
      if (action.type === 'ACCEPT' && classification.intent === 'question') {
        const isQuestionAllowed = canAskQuestion();

        if (!isQuestionAllowed) {
          voiceText = `Vamos a terminar esta actividad primero, después puedes preguntar.`;
          nextState = 'QUESTION';
        } else {
          questionCount += 1;
          lastQuestionTime = new Date().toISOString();
          event = { type: 'RAISE_HAND' };
          nextState = 'RESOLVING_DOUBT';
          newSavedStepIndex = currentStepIndex;
          newDoubtContext = { question: studentInput, stepIndex: currentStepIndex };
        }
      } else {
        // Evaluate answer
        let expectedAnswer = '';
        if (currentAtom.type === 'MCQ' || currentAtom.type === 'MINI_QUIZ') {
          const correctOption = currentAtom.options?.find((o) => o.isCorrect);
          expectedAnswer = correctOption?.text || '';
        } else if (currentAtom.content) {
          expectedAnswer = currentAtom.content;
        }

        const evaluation = await this.comprehensionEvaluator.evaluate({
          microQuestion: currentAtom.title,
          expectedAnswer,
          studentAnswer: studentInput,
          attemptNumber: failedAttempts + 1,
        });

        if (evaluation.result === 'correct') {
          event = { type: 'ANSWER', answer: studentInput, isCorrect: true };
          nextState = 'EVALUATION';
          shouldAdvanceStep = true;
        } else if (evaluation.result === 'partial') {
          nextState = 'QUESTION';
          if (evaluation.hint) {
            responseFeedback = (responseFeedback ? responseFeedback + ' ' : '') + evaluation.hint;
          }
        } else {
          // Incorrect - check if we should offer skip instead of escalating
          const updatedSession = await this.sessionRepo.incrementFailedAttempts(sessionId);
          const failedAttempts = updatedSession.failedAttempts || 0;

          if (
            failedAttempts >= this.config.skipAfterFailedAttempts &&
            this.config.enableActivitySkip
          ) {
            event = { type: 'OFFER_SKIP', reason: 'failed_attempts' };
            nextState = 'ACTIVITY_SKIP_OFFER';
          } else {
            event = { type: 'ANSWER', answer: studentInput, isCorrect: false };
            nextState = 'EVALUATION';
          }
        }
      }
    } else if (currentState === 'ACTIVITY_SKIP_OFFER') {
      // Handle skip offer response
      const lowerInput = studentInput.toLowerCase();

      if (
        lowerInput.includes('repetir') ||
        lowerInput.includes('repeat') ||
        lowerInput.includes('otra vez')
      ) {
        // Repeat the concept
        event = { type: 'REPEAT_CONCEPT' };
        nextState = 'EXPLANATION';
        failedAttempts = 0;
      } else if (
        lowerInput.includes('continuar') ||
        lowerInput.includes('continue') ||
        lowerInput.includes('siguiente') ||
        lowerInput.includes('saltar') ||
        lowerInput.includes('skip')
      ) {
        // Skip and continue
        event = { type: 'SKIP_ACTIVITY', skipAction: 'continue' };
        skippedActivities = [...skippedActivities, currentStep.atomId];
        shouldAdvanceStep = true;
        if (newStepIndex < steps.length - 1) {
          nextState = 'EXPLANATION';
        } else {
          nextState = 'COMPLETED';
          willComplete = true;
        }
      } else {
        // Invalid response, ask again
        voiceText =
          '¿Quieres que repita el tema o prefieres continuar? Dime "repetir" o "continuar".';
        nextState = 'ACTIVITY_SKIP_OFFER';
      }
    } else if (currentState === 'EVALUATION') {
      // Handle skip offer from evaluation
      const lowerInput = studentInput.toLowerCase();

      if (
        lowerInput.includes('repetir') ||
        lowerInput.includes('repeat') ||
        lowerInput.includes('otra vez')
      ) {
        event = { type: 'REPEAT_CONCEPT' };
        nextState = 'EXPLANATION';
        failedAttempts = 0;
      } else if (
        lowerInput.includes('continuar') ||
        lowerInput.includes('continue') ||
        lowerInput.includes('siguiente') ||
        lowerInput.includes('saltar')
      ) {
        event = { type: 'SKIP_ACTIVITY', skipAction: 'continue' };
        skippedActivities = [...skippedActivities, currentStep.atomId];
        shouldAdvanceStep = true;
        if (newStepIndex < steps.length - 1) {
          nextState = 'EXPLANATION';
        } else {
          nextState = 'COMPLETED';
          willComplete = true;
        }
      } else {
        // Normal advance
        event = { type: 'ADVANCE' };
        nextState = 'EXPLANATION';
        shouldAdvanceStep = true;
      }
    } else {
      nextState = currentState;
    }

    // Apply step advancement if needed
    if (shouldAdvanceStep) {
      if (newStepIndex < steps.length - 1) {
        newStepIndex += 1;
      } else {
        willComplete = true;
      }
    }

    const updatedCheckpoint = {
      currentState: nextState,
      currentStepIndex: newStepIndex,
      savedStepIndex: newSavedStepIndex,
      doubtContext: newDoubtContext,
      questionCount,
      lastQuestionTime,
      skippedActivities,
      failedAttempts,
    };

    // Record interactions
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: history.length + 1,
      transcript: studentInput,
      aiResponse: null,
      pausedForQuestion: false,
    });

    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: history.length + 2,
      transcript: voiceText,
      aiResponse: {
        text: voiceText,
        responseType: 'answer',
      },
      pausedForQuestion: false,
    });

    // Persist changes with lock if enabled
    if (this.advisoryLockManager) {
      const lockId = createSessionLockId(sessionId);
      await this.advisoryLockManager.acquireLock(lockId);
      try {
        if (willComplete) {
          await this.sessionRepo.complete(sessionId);
        } else {
          await this.sessionRepo.updateCheckpoint(sessionId, updatedCheckpoint);
        }
      } finally {
        await this.advisoryLockManager.releaseLock(lockId);
      }
    } else {
      if (willComplete) {
        await this.sessionRepo.complete(sessionId);
      } else {
        await this.sessionRepo.updateCheckpoint(sessionId, updatedCheckpoint);
      }
    }

    // Extract static content from the current step
    const staticContent = await this.extractStaticContent(currentStep);

    // Determine auto-advance behavior based on step type and state
    // Auto-advance: content steps (intro, content, closure) and after evaluation
    // Pause: activity steps that need user input
    const currentStepType = currentStep.stepType || 'content';
    const shouldAutoAdvance =
      // Auto-advance after content/explanation states
      (nextState === 'EXPLANATION' && currentStepType !== 'activity') ||
      // Auto-advance after evaluation (transitioning to next step)
      nextState === 'EVALUATION' ||
      // Auto-advance when transitioning from content to activity
      (currentState === 'EXPLANATION' &&
        currentStepType === 'activity' &&
        nextState === 'ACTIVITY_WAIT');

    // Default delay: 2 seconds for content, 1 second for evaluation transitions
    const autoAdvanceDelay = nextState === 'EVALUATION' ? 1500 : 2500;

    return {
      voiceText,
      pedagogicalState: nextState,
      sessionCompleted: willComplete,
      feedback: responseFeedback,
      isCorrect: aiResponse.isCorrect,
      extraExplanation: aiResponse.extraExplanation,
      staticContent,
      autoAdvance: shouldAutoAdvance,
      autoAdvanceDelay,
    };
  }
}
