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
import type { Session } from '@/domain/entities/session';
import { createRecipe, type Recipe, type RecipeStep } from '@/domain/entities/recipe';
import { createAtom, type Atom } from '@/domain/entities/atom';

// Helper to create a recipe with multiple steps (atoms)
function createMultiStepRecipe(recipeId: string, stepCount: number) {
  const atoms: Atom[] = [];
  const steps: RecipeStep[] = [];

  for (let i = 0; i < stepCount; i++) {
    const atomId = randomUUID();
    atoms.push({
      id: atomId,
      canonicalId: randomUUID(),
      title: `Atom ${i + 1}`,
      description: undefined,
      type: 'MICROLECTURE' as any,
      locale: 'es-AR',
      difficulty: 1,
      version: '1.0.0',
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      content: `Content for atom ${i + 1}`,
      options: undefined,
      competencies: undefined,
      attachments: undefined,
      knowledgeChunks: undefined,
    });

    steps.push({
      id: randomUUID(),
      recipeId,
      atomId,
      order: i,
      createdAt: new Date(),
    });
  }

  const recipe: Recipe = {
    id: recipeId,
    canonicalId: randomUUID(),
    title: 'Multi-Step Recipe',
    description: 'Recipe with multiple segments for integration testing',
    version: '1.0.0',
    published: true,
    steps,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { recipe, atoms, steps };
}

describe('OrchestrateRecipeUseCase - Multi-Segment Integration', () => {
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

  const recipeId = randomUUID();
  const studentId = randomUUID();

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
    } as any;

    mockAtomRepo = {
      findById: jest.fn(),
    } as any;

    mockUserRepo = {
      findById: jest.fn().mockResolvedValue({ id: studentId, name: 'Test Student' }),
    } as any;

    mockAiService = {
      generateResponse: jest.fn(),
    } as any;

    mockQuestionClassifier = {
      classify: jest.fn(),
    } as any;

    mockRagService = {
      retrieveChunks: jest.fn(),
    } as any;

    mockComprehensionEvaluator = {
      evaluate: jest.fn(),
    } as any;

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

  it('should complete full multi-segment flow: advance, doubt, and final completion', async () => {
    // Arrange: create recipe with 3 steps
    const { recipe, atoms, steps } = createMultiStepRecipe(recipeId, 3);
    mockRecipeRepo.findById.mockResolvedValue(recipe);
    mockRecipeRepo.findStepsByRecipeId.mockResolvedValue(steps);

    // Mock create to return the session passed in
    mockSessionRepo.create.mockImplementation(async (session) =>
      Promise.resolve({
        ...session,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as Session),
    );

    // 1. CALL start()
    mockAiService.generateResponse
      .mockResolvedValueOnce({
        explanation: 'Welcome to recipe!',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      })
      .mockResolvedValueOnce({
        explanation: 'Continuing...',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

    const startResult = await useCase.start(recipeId, studentId);
    const actualSessionId = startResult.sessionId;
    expect(startResult.pedagogicalState).toBe('ACTIVE_CLASS');

    // Capture the session that was created to use in subsequent calls
    const createdSessionArg = (mockSessionRepo.create as jest.Mock).mock.calls[0][0];
    let currentCheckpoint = createdSessionArg.stateCheckpoint;

    // After start, session created and checkpoint not changed yet (still segment 0)
    expect(mockSessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: actualSessionId,
        studentId,
        recipeId,
        status: 'IDLE',
      }),
    );

    // Helper to update mocks for each interact call
    const setupSessionForInteract = () => {
      const baseSession: Session = {
        ...createdSessionArg,
        id: actualSessionId,
        status: 'ACTIVE',
        stateCheckpoint: currentCheckpoint,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
      };
      mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);
      mockSessionRepo.findById.mockResolvedValue(baseSession);
    };

    // 2. INTERACT 1: user says something generic -> CONTINUE -> advance to segment 1
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: `Explanation for segment 1`,
      supportQuotes: [],
      pedagogicalState: 'ACTIVE_CLASS',
    });

    setupSessionForInteract();
    const interact1 = await useCase.interact(actualSessionId, 'I understand', studentId);
    expect(interact1.pedagogicalState).toBe('ACTIVE_CLASS');
    const updateCalls = mockSessionRepo.updateCheckpoint.mock.calls;
    const lastUpdate = updateCalls[updateCalls.length - 1];
    currentCheckpoint = lastUpdate[1] as any;

    // 3. INTERACT 2: continue -> advance to segment 2 (last)
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: `Explanation for segment 2`,
      supportQuotes: [],
      pedagogicalState: 'ACTIVE_CLASS',
    });

    setupSessionForInteract();
    const interact2 = await useCase.interact(actualSessionId, 'Got it', studentId);
    expect(interact2.pedagogicalState).toBe('ACTIVE_CLASS');
    const updateCalls2 = mockSessionRepo.updateCheckpoint.mock.calls;
    const lastUpdate2 = updateCalls2[updateCalls2.length - 1];
    currentCheckpoint = lastUpdate2[1] as any;

    // 4. INTERACT 3: raise a question -> RAISE_HAND -> RESOLVING_DOUBT
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'question', confidence: 0.9 });
    mockRagService.retrieveChunks.mockResolvedValue({
      chunks: [],
      totalAvailable: 0,
      retrievalMethod: 'embedding',
    });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Here is the answer to your question',
      supportQuotes: [],
      pedagogicalState: 'RESOLVING_DOUBT',
    });

    setupSessionForInteract();
    const interact3 = await useCase.interact(actualSessionId, 'I have a doubt', studentId);
    expect(interact3.pedagogicalState).toBe('RESOLVING_DOUBT');
    const updateCalls3 = mockSessionRepo.updateCheckpoint.mock.calls;
    const lastUpdate3 = updateCalls3[updateCalls3.length - 1];
    currentCheckpoint = lastUpdate3[1] as any;
    expect(currentCheckpoint.savedStepIndex).toBe(2);
    expect(currentCheckpoint.doubtContext).toEqual({
      question: 'I have a doubt',
      stepIndex: 2,
    });

    // 5. INTERACT 4: RESOLVING_DOUBT -> accept -> resume ACTIVE_CLASS with restored segment
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Great, continuing with the recipe',
      supportQuotes: [],
      pedagogicalState: 'ACTIVE_CLASS',
    });

    setupSessionForInteract();
    const interact4 = await useCase.interact(actualSessionId, 'Thanks, I understand', studentId);
    expect(interact4.pedagogicalState).toBe('ACTIVE_CLASS');
    const updateCalls4 = mockSessionRepo.updateCheckpoint.mock.calls;
    const lastUpdate4 = updateCalls4[updateCalls4.length - 1];
    currentCheckpoint = lastUpdate4[1] as any;
    expect(currentCheckpoint.savedStepIndex).toBeUndefined();
    expect(currentCheckpoint.doubtContext).toBeUndefined();
    expect(currentCheckpoint.currentStepIndex).toBe(2);

    // 6. INTERACT 5: final CONTINUE -> COMPLETE because last segment already reached
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Recipe finished, great work!',
      supportQuotes: [],
      pedagogicalState: 'ACTIVE_CLASS',
    });

    setupSessionForInteract();
    const interact5 = await useCase.interact(actualSessionId, 'Continue', studentId);
    expect(interact5.sessionCompleted).toBe(true);
    expect(mockSessionRepo.complete).toHaveBeenCalledWith(actualSessionId);
  });

  it('should handle CLARIFY flow within multi-segment recipe', async () => {
    // Arrange: recipe with 1 step (simpler)
    const { recipe, atoms, steps } = createMultiStepRecipe(recipeId, 1);
    mockRecipeRepo.findById.mockResolvedValue(recipe);
    mockRecipeRepo.findStepsByRecipeId.mockResolvedValue(steps);

    mockSessionRepo.create.mockImplementation(async (session) =>
      Promise.resolve({
        ...session,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as Session),
    );

    const initialSessionArg = {
      stateCheckpoint: {
        currentState: 'ACTIVE_CLASS',
        currentStepIndex: 0,
      },
    } as any;

    mockSessionRepo.create.mockResolvedValue(initialSessionArg as any);
    mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);

    // 1. start
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Welcome',
      supportQuotes: [],
      pedagogicalState: 'ACTIVE_CLASS',
    });
    const startResult = await useCase.start(recipeId, studentId);
    const actualSessionId = startResult.sessionId;

    // 2. INTERACT with medium confidence -> CLARIFY
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'question', confidence: 0.7 });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Can you clarify what part is confusing?',
      supportQuotes: [],
      pedagogicalState: 'CLARIFYING',
    });

    // Setup session for interact: after start, ACTIVE_CLASS
    mockSessionRepo.findById.mockResolvedValue({
      id: actualSessionId,
      studentId,
      recipeId,
      status: 'ACTIVE',
      stateCheckpoint: {
        currentState: 'ACTIVE_CLASS',
        currentStepIndex: 0,
      },
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
    } as Session);
    mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);

    const interact1 = await useCase.interact(actualSessionId, 'Not sure', studentId);
    expect(interact1.pedagogicalState).toBe('CLARIFYING');

    // Capture updated checkpoint after this interact
    const updateCalls1 = mockSessionRepo.updateCheckpoint.mock.calls;
    const lastUpdate1 = updateCalls1[updateCalls1.length - 1];
    const checkpointAfterClarify = lastUpdate1[1] as any;

    // 3. After clarification, resume
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Thanks for clarifying. Moving on.',
      supportQuotes: [],
      pedagogicalState: 'ACTIVE_CLASS',
    });

    // Session now in CLARIFYING
    mockSessionRepo.findById.mockResolvedValue({
      id: actualSessionId,
      studentId,
      recipeId,
      status: 'ACTIVE',
      stateCheckpoint: checkpointAfterClarify,
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
    } as Session);
    mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);

    const interact2 = await useCase.interact(actualSessionId, 'I was confused about X', studentId);
    expect(interact2.pedagogicalState).toBe('ACTIVE_CLASS');
    const updateCalls2 = mockSessionRepo.updateCheckpoint.mock.calls;
    const lastUpdate2 = updateCalls2[updateCalls2.length - 1];
    const checkpointAfterResume = lastUpdate2[1] as any;
    expect(checkpointAfterResume.currentState).toBe('ACTIVE_CLASS');
  });

  it('should escalate after failed attempts exceed threshold', async () => {
    // Arrange: recipe with question atom
    const { recipe, atoms, steps } = createMultiStepRecipe(recipeId, 1);
    mockRecipeRepo.findById.mockResolvedValue(recipe);
    mockRecipeRepo.findStepsByRecipeId.mockResolvedValue(steps);

    // Ensure first atom is a quiz type
    atoms[0].type = 'MCQ' as any;
    atoms[0].options = [
      {
        id: randomUUID(),
        atomId: atoms[0].id,
        text: '4',
        isCorrect: true,
        order: 0,
        feedback: 'Correct!',
      },
      { id: randomUUID(), atomId: atoms[0].id, text: '5', isCorrect: false, order: 1 },
    ];

    mockSessionRepo.create.mockImplementation(async (session) =>
      Promise.resolve({
        ...session,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        failedAttempts: 2,
      } as Session),
    );

    const session: Session = {
      id: randomUUID(),
      studentId,
      recipeId,
      status: 'ACTIVE',
      stateCheckpoint: {
        currentState: 'QUESTION',
        currentStepIndex: 0,
      },
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

    mockSessionRepo.findById.mockResolvedValue(session);
    mockAtomRepo.findById.mockResolvedValue(atoms[0]);
    mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);

    // INTERACT with wrong answer -> increment failedAttempts to 3 -> escalate
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
      result: 'incorrect',
      confidence: 0.3,
    });
    mockAiService.generateResponse.mockResolvedValueOnce({
      explanation: 'Incorrect, try again.',
      supportQuotes: [],
      pedagogicalState: 'QUESTION',
    });

    // Mock incrementFailedAttempts to return updated session with failedAttempts=3
    const sessionWithFailed3: Session = {
      ...session,
      failedAttempts: 3,
    };
    mockSessionRepo.incrementFailedAttempts.mockResolvedValue(sessionWithFailed3);

    const result = await useCase.interact(session.id, 'wrong answer', studentId);

    expect(mockSessionRepo.incrementFailedAttempts).toHaveBeenCalledWith(session.id);
    expect(mockSessionRepo.escalate).toHaveBeenCalledWith(session.id);
    expect(result.sessionCompleted).toBe(true);
    expect(result.pedagogicalState).toBe('QUESTION');
    expect(result.feedback).toBe('Escalated due to failed attempts');
  });
});
