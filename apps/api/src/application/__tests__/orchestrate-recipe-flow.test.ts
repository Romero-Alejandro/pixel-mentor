import { randomUUID } from 'node:crypto';

import { OrchestrateRecipeUseCase } from '@/application/use-cases/orchestrate-recipe.use-case';
import type { SessionRepository } from '@/domain/ports/session-repository';
import type { InteractionRepository } from '@/domain/ports/interaction-repository';
import type { RecipeRepository } from '@/domain/ports/recipe-repository';
import type { AtomRepository } from '@/domain/ports/atom-repository';
import type { UserRepository } from '@/domain/ports/user-repository';
import type { AIService } from '@/domain/ports/ai-service';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
} from '@/domain/ports/question-classifier';
import type { RAGService } from '@/domain/ports/rag-service';
import { RecipeNotFoundError } from '@/domain/ports/recipe-repository';
import { SessionNotFoundError, ActiveSessionExistsError } from '@/domain/ports/session-repository';
import { createRecipe, type Recipe, type RecipeStep } from '@/domain/entities/recipe';
import { createAtom, type Atom } from '@/domain/entities/atom';
import type { Session } from '@/domain/entities/session';
import { createSession } from '@/domain/entities/session';

describe('OrchestrateRecipeUseCase - Full Flow', () => {
  let useCase: OrchestrateRecipeUseCase;
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockInteractionRepo: jest.Mocked<InteractionRepository>;
  let mockRecipeRepo: jest.Mocked<RecipeRepository>;
  let mockAtomRepo: jest.Mocked<AtomRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockAiService: jest.Mocked<AIService>;
  let mockQuestionClassifier: jest.Mocked<QuestionClassifier>;
  let mockRagService: jest.Mocked<RAGService>;
  let mockComprehensionEvaluator: jest.Mocked<ComprehensionEvaluator>;

  const testRecipeId = randomUUID();
  const testStudentId = randomUUID();
  const testAtomId = randomUUID();
  const testStepId = randomUUID();

  const testAtom: Atom = {
    id: testAtomId,
    canonicalId: randomUUID(),
    title: 'Addition',
    description: undefined,
    type: 'MICROLECTURE' as any,
    locale: 'es-AR',
    difficulty: 1,
    version: '1.0.0',
    published: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    content: '2 + 2 = 4',
    options: undefined,
    competencies: undefined,
    attachments: undefined,
    knowledgeChunks: undefined,
  };

  const testStep: RecipeStep = {
    id: testStepId,
    recipeId: testRecipeId,
    atomId: testAtomId,
    order: 0,
    createdAt: new Date(),
  };

  const testRecipe: Recipe = {
    id: testRecipeId,
    canonicalId: randomUUID(),
    title: 'Math 101',
    description: 'Basic math concepts',
    version: '1.0.0',
    published: true,
    steps: [testStep],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAiResponse = {
    explanation: 'Hello, let me explain!',
    supportQuotes: [],
    pedagogicalState: 'ACTIVE_CLASS' as const,
  };

  beforeEach(() => {
    mockSessionRepo = {
      findById: jest.fn(),
      findByStudentAndRecipe: jest.fn(),
      findByStudent: jest.fn(),
      findActiveByStudent: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      updateCheckpoint: jest.fn(),
      complete: jest.fn(),
      escalate: jest.fn(),
      incrementFailedAttempts: jest.fn(),
    };

    mockInteractionRepo = {
      findById: jest.fn(),
      findBySession: jest.fn(),
      findBySessionOrdered: jest.fn(),
      create: jest.fn(),
    };

    mockRecipeRepo = {
      findById: jest.fn(),
      findStepsByRecipeId: jest.fn(),
    };

    mockAtomRepo = {
      findById: jest.fn(),
    };

    mockUserRepo = {
      findById: jest.fn().mockResolvedValue({ id: testStudentId, name: 'Test Student' }),
    };

    mockAiService = {
      generateResponse: jest.fn(),
      generateExplanation: jest.fn(),
      evaluateResponse: jest.fn(),
    };

    mockQuestionClassifier = {
      classify: jest.fn().mockResolvedValue({ intent: 'answer', confidence: 0.5 }),
    };

    mockRagService = {
      retrieveChunks: jest.fn(),
    };

    mockComprehensionEvaluator = {
      evaluate: jest.fn(),
    };

    useCase = new OrchestrateRecipeUseCase(
      mockSessionRepo,
      mockInteractionRepo,
      mockRecipeRepo,
      mockAtomRepo,
      mockUserRepo,
      mockAiService,
      mockQuestionClassifier,
      mockRagService,
      mockComprehensionEvaluator,
      undefined,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start()', () => {
    it('should start a recipe successfully', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(null);
      mockAiService.generateResponse.mockResolvedValueOnce(mockAiResponse);

      const result = await useCase.start(testRecipeId, testStudentId);

      expect(mockRecipeRepo.findById).toHaveBeenCalledWith(testRecipeId);
      expect(mockRecipeRepo.findStepsByRecipeId).toHaveBeenCalledWith(testRecipeId);
      expect(mockAtomRepo.findById).toHaveBeenCalledWith(testAtomId);
      expect(mockSessionRepo.findByStudentAndRecipe).toHaveBeenCalledWith(
        testStudentId,
        testRecipeId,
      );
      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: testStudentId,
          recipeId: testRecipeId,
          status: 'IDLE',
        }),
      );
      expect(mockAiService.generateResponse).toHaveBeenCalledWith({
        recipe: testRecipe,
        currentState: 'ACTIVE_CLASS',
        conversationHistory: [],
        currentSegment: {
          chunkText: testAtom.content || testAtom.title,
          order: testStep.order,
        },
        totalSegments: 1,
      });
      expect(mockInteractionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          turnNumber: 1,
          transcript: expect.stringContaining('Hello, let me explain!'),
        }),
      );
      expect(mockSessionRepo.updateStatus).toHaveBeenCalledWith(expect.any(String), 'ACTIVE');
      expect(mockSessionRepo.updateCheckpoint).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 0,
        }),
      );
      expect(result).toEqual({
        sessionId: expect.any(String),
        voiceText: expect.stringContaining('Hello, let me explain!'),
        pedagogicalState: 'ACTIVE_CLASS',
      });
    });

    it('should throw RecipeNotFoundError if recipe does not exist', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.start(testRecipeId, testStudentId)).rejects.toThrow(RecipeNotFoundError);
    });

    it('should return existing session if active session exists', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);

      const existingSessionId = randomUUID();
      const existingSession: Session = {
        id: existingSessionId,
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'ACTIVE',
        stateCheckpoint: { currentState: 'ACTIVE_CLASS', currentStepIndex: 0 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: null,
        outOfScope: false,
        failedAttempts: 0,
      };
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(existingSession);

      const result = await useCase.start(testRecipeId, testStudentId);

      expect(result.sessionId).toBe(existingSessionId);
      expect(result.resumed).toBe(true);
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
    });

    it('should return existing session if status is IDLE (resumable)', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);

      const existingSessionId = randomUUID();
      const existingSession: Session = {
        id: existingSessionId,
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'IDLE',
        stateCheckpoint: { currentState: 'AWAITING_START', currentStepIndex: 0 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: null,
        outOfScope: false,
        failedAttempts: 0,
      };
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(existingSession);

      const result = await useCase.start(testRecipeId, testStudentId);

      expect(result.sessionId).toBe(existingSessionId);
      expect(result.resumed).toBe(true);
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
    });

    it('should return existing session if status is PAUSED_FOR_QUESTION (resumable)', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);

      const existingSessionId = randomUUID();
      const existingSession: Session = {
        id: existingSessionId,
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'PAUSED_FOR_QUESTION',
        stateCheckpoint: { currentState: 'RESOLVING_DOUBT', currentStepIndex: 2 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: null,
        outOfScope: false,
        failedAttempts: 0,
      };
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(existingSession);

      const result = await useCase.start(testRecipeId, testStudentId);

      expect(result.sessionId).toBe(existingSessionId);
      expect(result.resumed).toBe(true);
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
    });

    it('should create new session if previous session is COMPLETED (terminal)', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce({
        id: randomUUID(),
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'COMPLETED' as const,
        stateCheckpoint: { currentState: 'COMPLETED' as const, currentStepIndex: 5 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: new Date(),
        escalatedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: null,
        outOfScope: false,
        failedAttempts: 0,
      });
      mockAiService.generateResponse.mockResolvedValueOnce(mockAiResponse);

      const result = await useCase.start(testRecipeId, testStudentId);

      expect(mockSessionRepo.create).toHaveBeenCalled();
      expect(result.resumed).toBe(false);
    });

    it('should create new session if previous session is ESCALATED (terminal)', async () => {
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce({
        id: randomUUID(),
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'ESCALATED' as const,
        stateCheckpoint: { currentState: 'ACTIVE_CLASS' as const, currentStepIndex: 2 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: new Date(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: 'max_attempts_exceeded',
        outOfScope: false,
        failedAttempts: 5,
      });
      mockAiService.generateResponse.mockResolvedValueOnce(mockAiResponse);

      const result = await useCase.start(testRecipeId, testStudentId);

      expect(mockSessionRepo.create).toHaveBeenCalled();
      expect(result.resumed).toBe(false);
    });
  });

  describe('interact()', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = randomUUID();
      mockQuestionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.5 });
    });

    it('should handle interaction successfully and complete session', async () => {
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);
      mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });

      const session: Session = {
        ...createSession({
          id: sessionId,
          studentId: testStudentId,
          recipeId: testRecipeId,
        }),
        status: 'ACTIVE',
        stateCheckpoint: {
          currentState: 'QUESTION',
          currentStepIndex: 0,
        },
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([]);
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'Correct!',
        supportQuotes: [],
        pedagogicalState: 'EVALUATION',
        isCorrect: true,
      });
      mockComprehensionEvaluator.evaluate.mockResolvedValue({
        result: 'correct',
        confidence: 0.9,
      });

      const result = await useCase.interact(sessionId, '4', testStudentId);

      expect(mockSessionRepo.complete).toHaveBeenCalledWith(sessionId);
      expect(result.sessionCompleted).toBe(true);
      // The pedagogicalState returned depends on state machine transitions after ADVANCE
      // We only assert that it's defined
      expect(result.pedagogicalState).toBeDefined();
      expect(result.isCorrect).toBe(true);
    });

    it('should update checkpoint and continue if not completed', async () => {
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValueOnce([testStep]);
      mockAtomRepo.findById.mockResolvedValueOnce(testAtom);

      const session: Session = {
        ...createSession({
          id: sessionId,
          studentId: testStudentId,
          recipeId: testRecipeId,
        }),
        status: 'ACTIVE',
        stateCheckpoint: {
          currentState: 'EXPLANATION',
          currentStepIndex: 0,
        },
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);
      mockRecipeRepo.findById.mockResolvedValueOnce(testRecipe);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([]);
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'What is 2 + 2?',
        supportQuotes: [],
        pedagogicalState: 'QUESTION',
      });

      const result = await useCase.interact(sessionId, 'answer', testStudentId);

      expect(mockSessionRepo.complete).not.toHaveBeenCalled();
      expect(mockSessionRepo.updateCheckpoint).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          currentState: 'QUESTION',
          currentStepIndex: 0,
        }),
      );
      expect(result.sessionCompleted).toBe(false);
    });

    it('should handle CLARIFY flow: ACTIVE_CLASS -> CLARIFYING -> ACTIVE_CLASS', async () => {
      const sessionActiveClass: Session = {
        ...createSession({
          id: sessionId,
          studentId: testStudentId,
          recipeId: testRecipeId,
        }),
        status: 'ACTIVE',
        stateCheckpoint: {
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 0,
        },
      };
      const sessionClarifying: Session = {
        ...sessionActiveClass,
        stateCheckpoint: {
          currentState: 'CLARIFYING',
          currentStepIndex: 0,
        },
      };

      mockSessionRepo.findById
        .mockResolvedValueOnce(sessionActiveClass)
        .mockResolvedValueOnce(sessionClarifying);
      mockRecipeRepo.findById.mockResolvedValue(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValue([testStep]);
      mockAtomRepo.findById.mockResolvedValue(testAtom);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);

      mockQuestionClassifier.classify.mockResolvedValue({ intent: 'question', confidence: 0.6 });
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: '¿Qué parte te confunde?',
        supportQuotes: [],
        pedagogicalState: 'CLARIFYING',
      });

      const result1 = await useCase.interact(sessionId, 'No entiendo la suma', testStudentId);

      expect(result1.pedagogicalState).toBe('CLARIFYING');
      expect(result1.sessionCompleted).toBe(false);
      expect(mockSessionRepo.updateCheckpoint).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ currentState: 'CLARIFYING' }),
      );

      mockRecipeRepo.findById.mockResolvedValue(testRecipe);
      mockQuestionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.7 });
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'Gracias. Continuemos.',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });
      mockInteractionRepo.findBySessionOrdered.mockResolvedValueOnce([
        {
          turnNumber: 1,
          transcript: '¿Qué parte te confunde?',
          aiResponse: { text: '¿Qué parte te confunde?', responseType: 'answer' },
        } as any,
      ]);

      const result2 = await useCase.interact(sessionId, 'La suma de dos números', testStudentId);

      expect(result2.pedagogicalState).toBe('ACTIVE_CLASS');
      expect(result2.sessionCompleted).toBe(false);
    });

    it('should escalate pre-AI when safetyFlag or outOfScope set', async () => {
      const sessionWithFlag: Session = {
        id: sessionId,
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'ACTIVE',
        stateCheckpoint: { currentState: 'ACTIVE_CLASS', currentStepIndex: 0 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: 'inappropriate_content',
        outOfScope: false,
        failedAttempts: 0,
      };
      mockSessionRepo.findById.mockResolvedValue(sessionWithFlag);
      mockRecipeRepo.findById.mockResolvedValue(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValue([testStep]);
      mockAtomRepo.findById.mockResolvedValue(testAtom);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);
      mockAiService.generateResponse.mockResolvedValue({
        explanation: 'Should not be called',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.interact(sessionId, 'something', testStudentId);

      expect(mockSessionRepo.escalate).toHaveBeenCalledWith(sessionId);
      expect(result.sessionCompleted).toBe(true);
      expect(result.feedback).toBe('Session escalated due to safety or repeated failures');
    });

    it('should escalate after failed attempts exceed threshold', async () => {
      const sessionWithFailures: Session = {
        id: sessionId,
        studentId: testStudentId,
        recipeId: testRecipeId,
        status: 'ACTIVE',
        stateCheckpoint: { currentState: 'QUESTION', currentStepIndex: 0 },
        currentInteractionId: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        safetyFlag: null,
        outOfScope: false,
        failedAttempts: 2,
      };
      mockSessionRepo.findById.mockResolvedValue(sessionWithFailures);
      mockRecipeRepo.findById.mockResolvedValue(testRecipe);
      mockRecipeRepo.findStepsByRecipeId.mockResolvedValue([testStep]);
      mockAtomRepo.findById.mockResolvedValue(testAtom);
      mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);

      mockQuestionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      mockComprehensionEvaluator.evaluate.mockResolvedValue({
        result: 'incorrect',
        confidence: 0.3,
      });
      mockAiService.generateResponse.mockResolvedValue({
        explanation: 'Incorrect, try again.',
        supportQuotes: [],
        pedagogicalState: 'QUESTION',
      });

      const sessionAfterIncrement: Session = {
        ...sessionWithFailures,
        failedAttempts: 3,
      };
      mockSessionRepo.incrementFailedAttempts.mockResolvedValue(sessionAfterIncrement);

      const result = await useCase.interact(sessionId, 'wrong answer', testStudentId);

      expect(mockSessionRepo.incrementFailedAttempts).toHaveBeenCalledWith(sessionId);
      expect(mockSessionRepo.escalate).toHaveBeenCalledWith(sessionId);
      expect(result.sessionCompleted).toBe(true);
      expect(result.pedagogicalState).toBe('QUESTION');
      expect(result.feedback).toBe('Escalated due to failed attempts');
    });

    it('should throw SessionNotFoundError if session does not exist', async () => {
      mockSessionRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.interact(sessionId, 'test', testStudentId)).rejects.toThrow(
        SessionNotFoundError,
      );
    });

    it('should throw error if session is not active', async () => {
      const session: Session = {
        ...createSession({
          id: sessionId,
          studentId: testStudentId,
          recipeId: testRecipeId,
        }),
        status: 'COMPLETED',
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);

      await expect(useCase.interact(sessionId, 'test', testStudentId)).rejects.toThrow(
        'Session is not active',
      );
    });

    it('should throw RecipeNotFoundError if recipe not found during interact', async () => {
      const session: Session = {
        ...createSession({
          id: sessionId,
          studentId: testStudentId,
          recipeId: testRecipeId,
        }),
        status: 'ACTIVE',
      };
      mockSessionRepo.findById.mockResolvedValueOnce(session);
      mockRecipeRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.interact(sessionId, 'test', testStudentId)).rejects.toThrow(
        RecipeNotFoundError,
      );
    });
  });
});
