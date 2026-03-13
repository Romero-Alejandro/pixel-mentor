import { randomUUID } from 'node:crypto';

import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { SessionNotFoundError } from '@/domain/ports/session-repository.js';
import type { InteractionRepository } from '@/domain/ports/interaction-repository.js';
import type { RecipeRepository } from '@/domain/ports/recipe-repository.js';
import { RecipeNotFoundError } from '@/domain/ports/recipe-repository.js';
import type { AtomRepository } from '@/domain/ports/atom-repository.js';
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
import type { InteractRecipeOutput } from '@/application/dto/index.js';
import { determineClassificationAction } from '@/domain/entities/question-classification.js';
import { ContextWindowService } from '@/application/services/context-window.service.js';

export class OrchestrateRecipeUseCase {
  constructor(
    private sessionRepo: SessionRepository,
    private interactionRepo: InteractionRepository,
    private recipeRepo: RecipeRepository,
    private atomRepo: AtomRepository,
    private aiService: AIService,
    private questionClassifier: QuestionClassifier,
    private ragService: RAGService,
    private comprehensionEvaluator: ComprehensionEvaluator,
    private advisoryLockManager?: AdvisoryLockManager,
    private contextWindowService: ContextWindowService = new ContextWindowService(),
  ) {}

  async start(
    recipeId: string,
    studentId: string,
  ): Promise<{
    sessionId: string;
    voiceText: string;
    pedagogicalState: PedagogicalState;
  }> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    const steps = await this.recipeRepo.findStepsByRecipeId(recipeId);
    if (steps.length === 0) {
      throw new Error('Recipe has no steps');
    }

    const firstStep = steps[0];
    const firstAtom = await this.atomRepo.findById(firstStep.atomId);
    if (!firstAtom) {
      throw new Error(`Atom with ID ${firstStep.atomId} not found`);
    }

    // Check for existing active session
    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);
    if (existing && existing.status === 'ACTIVE') {
      return {
        sessionId: existing.id,
        voiceText: 'Continuing with existing session',
        pedagogicalState: existing.stateCheckpoint.currentState,
      };
    }

    const sessionId = randomUUID();
    await this.sessionRepo.create({
      id: sessionId,
      studentId,
      recipeId,
      status: 'IDLE',
      stateCheckpoint: {
        currentState: 'ACTIVE_CLASS',
        currentStepIndex: 0,
      },
    });

    // Prepare currentSegment for prompt: expects object with chunkText and order
    const aiResponse = await this.aiService.generateResponse({
      recipe,
      currentState: 'ACTIVE_CLASS',
      conversationHistory: [],
      currentSegment: {
        chunkText: firstAtom.content || firstAtom.title,
        order: firstStep.order,
      },
      totalSegments: steps.length,
    });

    const voiceText =
      aiResponse.explanation +
      (aiResponse.microInteraction ? '\n' + aiResponse.microInteraction.text : '');

    const tutorInteractionId = randomUUID();
    await this.interactionRepo.create({
      id: tutorInteractionId,
      sessionId,
      turnNumber: 1,
      transcript: voiceText,
      aiResponse: {
        text: voiceText,
        responseType: 'explanation',
      },
      pausedForQuestion: false,
    });

    await this.sessionRepo.updateStatus(sessionId, 'ACTIVE');
    await this.sessionRepo.updateCheckpoint(sessionId, {
      currentState: aiResponse.pedagogicalState,
      currentStepIndex: 0,
    });

    return {
      sessionId,
      voiceText,
      pedagogicalState: aiResponse.pedagogicalState,
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

    const voiceText =
      aiResponse.explanation +
      (aiResponse.microInteraction ? '\n' + aiResponse.microInteraction.text : '');

    let responseFeedback = aiResponse.feedback;
    let nextState: PedagogicalState;
    let event: StateEvent | null = null;
    let shouldAdvanceStep = false;
    let willComplete = false;

    // State machine transitions
    if (currentState === 'ACTIVE_CLASS') {
      if (action.type === 'ACCEPT' && classification.intent === 'question') {
        event = { type: 'RAISE_HAND' };
      } else if (action.type === 'CLARIFY') {
        event = { type: 'CLARIFY' };
      } else {
        event = { type: 'CONTINUE' };
      }

      if (!isTransitionAllowed(currentState, event.type)) {
        throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
      }
      nextState = getNextState(currentState, event);

      if (nextState === 'RESOLVING_DOUBT') {
        newSavedStepIndex = currentStepIndex;
        newDoubtContext = { question: studentInput, stepIndex: currentStepIndex };
      }

      // CONTINUE advances step
      if (event.type === 'CONTINUE') {
        if (newStepIndex < steps.length - 1) {
          shouldAdvanceStep = true;
        } else {
          nextState = 'COMPLETED';
          willComplete = true;
        }
      }
    } else if (currentState === 'RESOLVING_DOUBT') {
      if (action.type === 'ACCEPT') {
        event = { type: 'RESUME_CLASS' };
        if (!isTransitionAllowed(currentState, event.type)) {
          throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
        }
        nextState = getNextState(currentState, event);
        if (newSavedStepIndex !== undefined) {
          newStepIndex = newSavedStepIndex;
        }
        newSavedStepIndex = undefined;
        newDoubtContext = undefined;
      } else {
        nextState = 'RESOLVING_DOUBT';
        event = null;
      }
    } else if (currentState === 'CLARIFYING') {
      event = { type: 'RESUME_CLASS' };
      if (!isTransitionAllowed(currentState, event.type)) {
        throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
      }
      nextState = getNextState(currentState, event);
    } else if (currentState === 'EXPLANATION') {
      event = { type: 'EXPLAIN', conceptIndex: 0 };
      if (!isTransitionAllowed(currentState, event.type)) {
        throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
      }
      nextState = getNextState(currentState, event);
    } else if (currentState === 'QUESTION') {
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
        attemptNumber: 1,
      });

      if (evaluation.result === 'correct') {
        event = { type: 'ANSWER', answer: studentInput };
        if (!isTransitionAllowed(currentState, event.type)) {
          throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
        }
        const stateAfterAnswer = getNextState(currentState, event);
        // Advance to next step after correct answer
        const advanceEvent: StateEvent = { type: 'ADVANCE' };
        nextState = getNextState(stateAfterAnswer, advanceEvent);
        shouldAdvanceStep = true;
      } else if (evaluation.result === 'partial') {
        nextState = 'QUESTION';
        if (evaluation.hint) {
          responseFeedback = (responseFeedback ? responseFeedback + ' ' : '') + evaluation.hint;
        }
      } else {
        const updatedSession = await this.sessionRepo.incrementFailedAttempts(sessionId);
        if (updatedSession.failedAttempts && updatedSession.failedAttempts >= 3) {
          await this.sessionRepo.escalate(sessionId);
          return {
            voiceText: 'Escalated due to failed attempts',
            pedagogicalState: currentState,
            sessionCompleted: true,
            feedback: 'Escalated due to failed attempts',
          };
        }
        event = { type: 'ANSWER', answer: studentInput };
        if (!isTransitionAllowed(currentState, event.type)) {
          throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
        }
        nextState = getNextState(currentState, event);
      }
    } else if (currentState === 'EVALUATION') {
      event = { type: 'ADVANCE' };
      if (!isTransitionAllowed(currentState, event.type)) {
        throw new Error(`Invalid transition from ${currentState} with event ${event.type}`);
      }
      nextState = getNextState(currentState, event);
      shouldAdvanceStep = true;
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

    return {
      voiceText,
      pedagogicalState: nextState,
      sessionCompleted: willComplete,
      feedback: responseFeedback,
      isCorrect: aiResponse.isCorrect,
      extraExplanation: aiResponse.extraExplanation,
    };
  }
}
