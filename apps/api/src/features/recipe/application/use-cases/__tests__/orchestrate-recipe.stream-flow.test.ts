import { OrchestrateRecipeUseCase } from '../orchestrate-recipe.use-case';
import { randomUUID } from 'crypto';

// Mock logger
jest.mock('@/shared/logger/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock event bus
const mockEventBus = { emit: jest.fn() };
jest.mock('@/shared/events/event-bus.port.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
}));

// Mock repositories and services
const mockSessionRepo = {
  findById: jest.fn(),
  findByStudentAndRecipe: jest.fn(),
  create: jest.fn(),
  updateCheckpoint: jest.fn(),
  complete: jest.fn(),
  resetProgress: jest.fn(),
  updateStatus: jest.fn(),
  escalate: jest.fn(),
};

const mockInteractionRepo = {
  create: jest.fn(),
  findBySessionOrdered: jest.fn(() => Promise.resolve([])), // Return empty history
  deleteBySession: jest.fn(),
};

const mockRecipeRepo = {
  findById: jest.fn(),
  findStepsByRecipeId: jest.fn(),
};

const mockConceptRepo = {};
const mockActivityRepo = {};

const mockAtomRepo = {
  findById: jest.fn(),
};

const mockUserRepo = {
  findById: jest.fn(),
};

const mockAiService = {
  generateResponseStream: jest.fn(),
  generateResponse: jest.fn(),
};

const mockQuestionClassifier = {
  classify: jest.fn(),
};

const mockRagService = {
  retrieveChunks: jest.fn(),
};

const mockComprehensionEvaluator = {
  evaluate: jest.fn(),
};

const mockLessonEvaluator = {
  evaluate: jest.fn(),
};

const mockAdvisoryLockManager = {
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
};

const mockFeatureFlagService = {
  shouldUseNewEngine: jest.fn(),
};

const mockActivityAttemptRepo = {
  findByUserIdAndAtomId: jest.fn(),
};

const mockContextWindowService = {
  trimHistory: jest.fn((history) => history),
  summarizeOlderTurns: jest.fn(() => 'summary'),
};

// Shared test recipe steps (matches seed structure)
const testRecipeSteps = [
  {
    atomId: 'atom-1',
    stepType: 'intro',
    order: 0,
    script: { content: 'Welcome to the lesson!', transition: "Let's start." },
  },
  {
    atomId: 'atom-2',
    stepType: 'content',
    order: 1,
    script: { content: 'This is the first content step.' },
  },
  {
    atomId: 'atom-3',
    stepType: 'content',
    order: 2,
    script: { content: 'This is the second content step.' },
  },
  {
    atomId: 'atom-4',
    stepType: 'question',
    order: 3,
    script: {
      question: 'What is the capital of France?',
      expectedAnswer: 'Paris',
      feedback: { correct: 'Correct!', incorrect: 'Incorrect.' },
    },
  },
  {
    atomId: 'atom-5',
    stepType: 'content',
    order: 4,
    script: { content: 'This content comes after the question.' },
  },
  {
    atomId: 'atom-6',
    stepType: 'activity',
    order: 5,
    script: {
      instruction: 'Select the correct option.',
      options: [
        { text: 'Option A', isCorrect: false },
        { text: 'Option B', isCorrect: true },
      ],
      feedback: { correct: 'Good job!', incorrect: 'Try again.' },
    },
  },
  {
    atomId: 'atom-7',
    stepType: 'closure',
    order: 6,
    script: { content: 'Lesson completed!' },
  },
];

const mockRecipe = {
  id: randomUUID(),
  title: 'Test Recipe',
  meta: {
    greetings: {
      intro: 'Hello {name}, welcome to {title}!',
      readyPrompt: 'Are you ready?',
      completionMessage: 'Lesson {title} completed!',
    },
    enableActivitySkip: true,
    maxQuestionsPerSession: 3,
    questionCooldownSeconds: 60,
    skipAfterFailedAttempts: 2,
  },
};

const mockUser = {
  id: randomUUID(),
  name: 'Test Student',
  cohort: 'default',
};

const mockAtoms: Record<string, any> = testRecipeSteps.reduce(
  (acc: Record<string, any>, step: any) => {
    acc[step.atomId] = {
      id: step.atomId,
      title: `Atom ${step.order}`,
      content: `Content for ${step.atomId}`,
    };
    return acc;
  },
  {},
);

describe('OrchestrateRecipeUseCase - Streaming Flow Tests', () => {
  let orchestrator: OrchestrateRecipeUseCase;
  const studentId = randomUUID();
  const recipeId = randomUUID();

  beforeEach(() => {
    jest.clearAllMocks();

    orchestrator = new OrchestrateRecipeUseCase(
      mockSessionRepo as any,
      mockInteractionRepo as any,
      mockRecipeRepo as any,
      mockConceptRepo as any,
      mockActivityRepo as any,
      mockAtomRepo as any,
      mockUserRepo as any,
      mockAiService as any,
      mockQuestionClassifier as any,
      mockRagService as any,
      mockComprehensionEvaluator as any,
      mockLessonEvaluator as any,
      mockAdvisoryLockManager as any,
      mockContextWindowService as any,
      mockFeatureFlagService as any,
      mockActivityAttemptRepo as any,
    );

    // Recipe and atom mocks
    mockRecipeRepo.findById.mockResolvedValue(mockRecipe);
    mockRecipeRepo.findStepsByRecipeId.mockResolvedValue(testRecipeSteps);
    mockUserRepo.findById.mockResolvedValue(mockUser);
    mockAtomRepo.findById.mockImplementation((id: string) => Promise.resolve(mockAtoms[id]));

    // AI streaming mock: yields a single chunk
    mockAiService.generateResponseStream.mockImplementation(async function* () {
      yield 'AI response chunk';
    });

    // Classifier mock: by default, return 'statement' to auto-advance
    mockQuestionClassifier.classify.mockResolvedValue({ intent: 'statement', confidence: 0.9 });

    // Default evaluator mocks (for question answering later)
    mockLessonEvaluator.evaluate.mockResolvedValue({
      outcome: 'conceptually_correct',
      confidence: 0.9,
      improvementSuggestion: null,
    });
    mockComprehensionEvaluator.evaluate.mockResolvedValue({
      result: 'correct',
      confidence: 0.9,
      hint: null,
    });

    // Session state will be set per-test
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should include staticContent in all end chunks, even after LLM-driven auto-advance', async () => {
    const testSessionId = randomUUID();

    // Spy on randomUUID to return the same testSessionId whenever called during session creation
    const randomUUIDSpy = jest
      .spyOn(require('crypto'), 'randomUUID')
      .mockReturnValue(testSessionId);

    let sessionState: any = {
      id: testSessionId,
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
        totalWrongAnswers: 0,
      },
      startedAt: new Date(),
      lastActivityAt: new Date(),
      completedAt: null,
      escalatedAt: null,
    };

    mockSessionRepo.findById.mockImplementation((id: string) => {
      if (id === testSessionId) {
        return Promise.resolve(sessionState);
      }
      return Promise.resolve(null);
    });
    mockSessionRepo.create.mockResolvedValueOnce(sessionState);
    mockSessionRepo.updateCheckpoint.mockImplementation((id: string, cp: any) => {
      if (id === testSessionId) {
        sessionState.stateCheckpoint = { ...sessionState.stateCheckpoint, ...cp };
      }
      return Promise.resolve({ id, stateCheckpoint: sessionState.stateCheckpoint });
    });
    mockSessionRepo.complete.mockImplementation((id: string) => {
      if (id === testSessionId) {
        sessionState.status = 'COMPLETED';
        sessionState.stateCheckpoint.currentState = 'COMPLETED';
      }
      return Promise.resolve(undefined);
    });
    mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(null);

    // Expected staticContent step types per full step index (based on testRecipeSteps)
    // intro -> 'intro', content -> 'content', question -> 'activity', activity -> 'activity', closure -> 'closure'
    const expectedStepTypes = [
      'intro',
      'content',
      'content',
      'activity',
      'content',
      'activity',
      'closure',
    ];

    // Helper to extract 'end' chunk from async generator
    const getEndChunk = async (gen: AsyncGenerator<any>) => {
      let endChunk: any = null;
      for await (const chunk of gen) {
        if (chunk.type === 'end') {
          endChunk = chunk;
          break;
        }
      }
      expect(endChunk).not.toBeNull();
      return endChunk;
    };

    // 1. Start the lesson (using non-streaming start)
    const startResult = await orchestrator.start(recipeId, studentId);
    expect(startResult.sessionId).toBe(testSessionId);

    // 2. Interact: "ok" to start (AWAITING_START -> EXPLANATION for intro)
    let gen = orchestrator.interactStream(testSessionId, 'ok', studentId);
    let endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('EXPLANATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[0]); // intro
    expect(endChunk.lessonProgress.currentStep).toBe(0);

    // 3. Navigate to first content step (nav fast path)
    gen = orchestrator.interactStream(testSessionId, 'continuar', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('EXPLANATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[1]); // content
    expect(endChunk.lessonProgress.currentStep).toBe(1);

    // 4. Non-nav input to trigger LLM processing and auto-advance to second content step
    // The classifier will ACCEPT with intent 'statement' -> else -> advance
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'statement', confidence: 0.9 });
    gen = orchestrator.interactStream(testSessionId, 'tell me more', studentId);
    endChunk = await getEndChunk(gen);
    // Should have auto-advanced to step 2 (content)
    expect(endChunk.pedagogicalState).toBe('EXPLANATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[2]); // content
    expect(endChunk.lessonProgress.currentStep).toBe(2);

    // 5. Navigate to question step (nav fast path)
    gen = orchestrator.interactStream(testSessionId, 'continuar', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('ACTIVITY_WAIT');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[3]); // activity (question)
    expect(endChunk.lessonProgress.currentStep).toBe(3);

    // 6. Answer the question correctly (LLM evaluation for question)
    mockQuestionClassifier.classify.mockResolvedValueOnce({ intent: 'answer', confidence: 0.9 });
    gen = orchestrator.interactStream(testSessionId, 'Paris', studentId);
    endChunk = await getEndChunk(gen);
    // After correct answer, state becomes EVALUATION, still on step 3
    expect(endChunk.pedagogicalState).toBe('EVALUATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[3]); // still activity (question)
    expect(endChunk.lessonProgress.currentStep).toBe(3);

    // 7. Navigate from EVALUATION to content after question (nav fast path)
    gen = orchestrator.interactStream(testSessionId, 'continuar', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('EXPLANATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[4]); // content
    expect(endChunk.lessonProgress.currentStep).toBe(4);

    // 8. Navigate to activity step (nav fast path)
    gen = orchestrator.interactStream(testSessionId, 'continuar', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('ACTIVITY_WAIT');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[5]); // activity
    expect(endChunk.lessonProgress.currentStep).toBe(5);

    // 9. Answer activity correctly (LLM path for activity? Actually, ACTIVITY_WAIT for activity in streaming does NOT fast-return? It does: for activity (MCQ) it handles fast and returns? Let's recall: in ACTIVITY_WAIT, if stepType === 'activity', they handle MCQ and then return with an 'end' chunk (lines 1770-1781). That's a fast path that includes staticContent. So it's already covered. We'll test answer.
    gen = orchestrator.interactStream(testSessionId, 'Option B', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('EVALUATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[5]); // activity
    expect(endChunk.lessonProgress.currentStep).toBe(5);

    // 10. Navigate to closure (nav fast path from EVALUATION)
    gen = orchestrator.interactStream(testSessionId, 'continuar', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.pedagogicalState).toBe('EXPLANATION');
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[6]); // closure
    expect(endChunk.lessonProgress.currentStep).toBe(6);

    // 11. Complete the lesson by navigating past closure
    gen = orchestrator.interactStream(testSessionId, 'continuar', studentId);
    endChunk = await getEndChunk(gen);
    expect(endChunk.sessionCompleted).toBe(true);
    expect(endChunk.pedagogicalState).toBe('COMPLETED');
    // On completion, staticContent may be for the last step or could be undefined? In our fix, we set displayStep = willComplete ? currentStep : ... So for completion, willComplete=true, displayStep=currentStep (which is closure step index 6). Should have staticContent.
    expect(endChunk.staticContent).toBeDefined();
    expect(endChunk.staticContent!.stepType).toBe(expectedStepTypes[6]); // closure
  });
});
