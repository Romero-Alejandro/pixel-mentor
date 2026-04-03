import { OrchestrateRecipeUseCase } from '../orchestrate-recipe.use-case';
import { randomUUID } from 'crypto';
import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine';
import type { Session } from '@/features/session/domain/entities/session.entity'; // Corrected import for Session type

// Mocks for dependencies
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
  findBySessionOrdered: jest.fn(),
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
  generateResponse: jest.fn(),
  generateResponseStream: jest.fn(),
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

// Mock the logger to prevent console output during tests
jest.mock('@/shared/logger/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock the event bus to prevent errors during tests
const mockEventBus = {
  emit: jest.fn(),
};

jest.mock('@/shared/events/event-bus.port.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
}));

const mockContextWindowService = {
  trimHistory: jest.fn((history) => history), // Return full history for simplicity
  summarizeOlderTurns: jest.fn(() => 'summary'),
};

describe('OrchestrateRecipeUseCase - Flow Tests', () => {
  let orchestrator: OrchestrateRecipeUseCase;
  const studentId = randomUUID();
  const recipeId = randomUUID();

  // Define a test recipe with various step types
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

  // Mock initial data
  const mockRecipe = {
    id: recipeId,
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
    id: studentId,
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
      mockContextWindowService as any, // Inject mock ContextWindowService
      mockFeatureFlagService as any,
      mockActivityAttemptRepo as any,
    );

    // Default mock implementations for repos
    mockRecipeRepo.findById.mockResolvedValue(mockRecipe);
    mockRecipeRepo.findStepsByRecipeId.mockResolvedValue(testRecipeSteps);
    mockUserRepo.findById.mockResolvedValue(mockUser);
    mockAtomRepo.findById.mockImplementation((id: string) => Promise.resolve(mockAtoms[id]));

    // Default session mocks: assume no session found, or minimal session data
    mockSessionRepo.findById.mockResolvedValue(null); // Default to not finding a session
    mockSessionRepo.findByStudentAndRecipe.mockResolvedValue(null); // Default to no existing session
    mockSessionRepo.create.mockImplementation((sessionData) =>
      Promise.resolve({ ...sessionData, id: sessionData.id || randomUUID() }),
    );
    mockSessionRepo.updateCheckpoint.mockImplementation((id: string, cp: any) =>
      Promise.resolve({ id, stateCheckpoint: cp }),
    );
    mockSessionRepo.complete.mockResolvedValue(undefined);
    mockSessionRepo.escalate.mockResolvedValue(undefined);
    mockSessionRepo.resetProgress.mockImplementation((id) =>
      Promise.resolve({
        id,
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
          totalWrongAnswers: 0,
        },
      }),
    );
    mockSessionRepo.updateStatus.mockResolvedValue(undefined);

    mockInteractionRepo.findBySessionOrdered.mockResolvedValue([]);
    mockInteractionRepo.create.mockResolvedValue(undefined);

    mockAdvisoryLockManager.acquireLock.mockResolvedValue(true);
    mockAdvisoryLockManager.releaseLock.mockResolvedValue(true);
    mockFeatureFlagService.shouldUseNewEngine.mockReturnValue(false); // Use legacy engine by default
    mockAiService.generateResponse.mockResolvedValue({
      explanation: 'AI response',
      supportQuotes: [],
      pedagogicalState: 'EXPLANATION',
    });

    // Default LLM mocks for when we don't care about their specific output
    mockQuestionClassifier.classify.mockResolvedValue({ intent: 'continue', confidence: 0.9 });
    mockComprehensionEvaluator.evaluate.mockResolvedValue({
      result: 'correct',
      confidence: 0.9,
      hint: null,
    });
    mockLessonEvaluator.evaluate.mockResolvedValue({
      outcome: 'conceptually_correct',
      confidence: 0.9,
      improvementSuggestion: null,
    });
    mockActivityAttemptRepo.findByUserIdAndAtomId.mockResolvedValue([]);

    // Mock RAG service to return empty chunks by default
    mockRagService.retrieveChunks.mockResolvedValue({ chunks: [] });

    // Mock Date.now() for consistent snapshots if needed
    const MOCK_DATE = new Date('2023-01-01T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => MOCK_DATE as any);
    jest.spyOn(MOCK_DATE, 'toISOString').mockReturnValue('2023-01-01T12:00:00.000Z');
    // Mock Date.now() static method
    (global.Date as any).now = jest.fn().mockReturnValue(MOCK_DATE.getTime());
  });

  afterAll(() => {
    jest.restoreAllMocks(); // Restore Date mock
  });

  describe('Unit test for backend orchestration', () => {
    it('should simulate the entire class flow step by step and verify transitions', async () => {
      let result: any;
      let studentInput: string;

      // --- Session State Management for this test ---
      const testSessionId = randomUUID(); // Unique session ID for this test

      // Mock randomUUID to return testSessionId for session ID generation
      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue(testSessionId);

      let sessionState: Session = {
        id: testSessionId,
        studentId: studentId,
        recipeId: recipeId,
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
      };

      // Mock sessionRepo.findById to return the current sessionState for this test
      mockSessionRepo.findById.mockImplementation((id: string) => {
        if (id === testSessionId) {
          return Promise.resolve(sessionState);
        }
        return Promise.resolve(null);
      });
      // Mock sessionRepo.create to return the testSessionId for this test
      mockSessionRepo.create.mockResolvedValueOnce(sessionState);
      // Mock sessionRepo.updateCheckpoint to update the sessionState for this test
      mockSessionRepo.updateCheckpoint.mockImplementation((id: string, cp: any) => {
        if (id === testSessionId) {
          sessionState.stateCheckpoint = { ...sessionState.stateCheckpoint, ...cp };
        }
        return Promise.resolve({ id, stateCheckpoint: sessionState.stateCheckpoint });
      });
      // Mock complete to update sessionState status for this test
      mockSessionRepo.complete.mockImplementation((id: string) => {
        if (id === testSessionId) {
          sessionState.status = 'COMPLETED';
          sessionState.stateCheckpoint.currentState = 'COMPLETED';
        }
        return Promise.resolve(undefined);
      });
      // Mock findByStudentAndRecipe to return null initially for this test
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(null);

      // 1. Call start() - creates a new session
      result = await orchestrator.start(recipeId, studentId);

      expect(result.sessionId).toBe(testSessionId);
      expect(result.voiceText).toContain('Hello Test Student, welcome to Test Recipe!');
      expect(result.pedagogicalState).toBe('AWAITING_START');
      expect(result.contentSteps).toHaveLength(5); // intro, content, content, content, closure

      // For AWAITING_START, we manually transition with 'ok'
      studentInput = 'ok';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION'); // intro step
      expect(result.staticContent.stepType).toBe('intro');

      // Advance through content steps with "continuar"
      for (let i = 1; i <= 2; i++) {
        // content step 1 (idx 1), content step 2 (idx 2)
        studentInput = 'continuar';
        result = await orchestrator.interact(testSessionId, studentInput, studentId);

        expect(result.pedagogicalState).toBe('EXPLANATION');
        expect(result.staticContent.stepType).toBe('content');
        expect(result.staticContent.script.content).toContain(
          `This is the ${i === 1 ? 'first' : 'second'} content step.`,
        );
      }

      // 3. Reach question step (index 3)
      // The current pedagogicalState is EXPLANATION for step 2. 'continuar' should advance to question.
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');
      expect(result.staticContent.stepType).toBe('activity'); // Question is treated as activity in frontend
      expect(result.staticContent.activity.instruction).toBe('What is the capital of France?');

      // Try incorrect answer for question
      studentInput = 'London';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'incorrect',
        confidence: 0.8,
        hint: 'It starts with P',
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.voiceText).toBe('Incorrect.');
      expect(result.isCorrect).toBe(false);

      // Try correct answer for question
      studentInput = 'Paris';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
        hint: null,
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.voiceText).toBe('Correct!');
      expect(result.isCorrect).toBe(true);

      // Advance from question to next content step (index 4)
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('content');
      expect(result.staticContent.script.content).toContain(
        'This content comes after the question.',
      );

      // 4. Reach activity step (index 5)
      // The current pedagogicalState is EXPLANATION for step 4. 'continuar' should advance to activity.
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');
      expect(result.staticContent.stepType).toBe('activity');
      expect(result.staticContent.activity.instruction).toBe('Select the correct option.');

      // Try incorrect answer for activity
      studentInput = 'Option A';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EVALUATION'); // Failed attempts < skipAfterFailedAttempts
      expect(result.voiceText).toBe('Try again.');
      expect(result.isCorrect).toBe(false);

      // Try correct answer for activity
      studentInput = 'Option B';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.voiceText).toBe('Good job!');
      expect(result.isCorrect).toBe(true);

      // Advance from activity to closure step (index 6)
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION'); // closure step
      expect(result.staticContent.stepType).toBe('closure');
      expect(result.staticContent.script.content).toBe('Lesson completed!');

      // Complete the lesson
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('COMPLETED');
      expect(result.sessionCompleted).toBe(true);
      expect(result.voiceText).toContain('Lesson Test Recipe completed!');
      expect(mockSessionRepo.complete).toHaveBeenCalledWith(testSessionId);
      expect(mockEventBus.emit).toHaveBeenCalledWith('LESSON_COMPLETED', expect.any(Object));
    });

    it('should handle question intent during content steps', async () => {
      let result: any;
      let studentInput: string;
      const testSessionId = randomUUID();

      // --- Session State Management for this test ---
      let sessionState: Session = {
        id: testSessionId,
        studentId: studentId,
        recipeId: recipeId,
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
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(null);

      result = await orchestrator.start(recipeId, studentId);

      // Start the lesson
      studentInput = 'ok';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('intro');

      // Advance to the first content step
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('content');

      // Student asks a question during content step
      studentInput = 'What does this mean?';
      mockQuestionClassifier.classify.mockResolvedValueOnce({
        intent: 'question',
        confidence: 0.9,
      });
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'AI explanation for the doubt.',
        supportQuotes: [],
        pedagogicalState: 'RESOLVING_DOUBT',
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('RESOLVING_DOUBT');
      expect(result.voiceText).toBe('AI explanation for the doubt.');

      // Student continues after doubt resolved
      studentInput = 'Thanks';
      mockQuestionClassifier.classify.mockResolvedValueOnce({
        intent: 'continue',
        confidence: 0.9,
      });
      mockAiService.generateResponse.mockResolvedValueOnce({
        explanation: 'AI response',
        supportQuotes: [],
        pedagogicalState: 'EXPLANATION',
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION'); // Returns to original step/state
      expect(result.staticContent.script.content).toContain('This is the first content step.');
      expect(result.voiceText).toContain('Continuemos donde lo dejamos.');

      // Continue to next content step (index 2)
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('content');
      expect(result.staticContent.script.content).toContain('This is the second content step.');

      // ... then complete the flow for this test
      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');
      expect(result.staticContent.stepType).toBe('activity'); // Question is treated as activity in frontend

      studentInput = 'Paris';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
        hint: null,
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.isCorrect).toBe(true);

      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('content');

      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');
      expect(result.staticContent.stepType).toBe('activity');

      studentInput = 'Option B';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.isCorrect).toBe(true);

      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('closure');

      studentInput = 'continuar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('COMPLETED');
      expect(result.sessionCompleted).toBe(true);
    });

    it('should allow repeating a question/activity if requested from EVALUATION state', async () => {
      let result: any;
      let studentInput: string;
      const testSessionId = randomUUID();

      // --- Session State Management for this test ---
      let sessionState: Session = {
        id: testSessionId,
        studentId: studentId,
        recipeId: recipeId,
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
      mockSessionRepo.resetProgress.mockImplementation((id) => {
        if (id === testSessionId) {
          sessionState = {
            ...sessionState,
            status: 'IDLE',
            stateCheckpoint: {
              currentState: 'AWAITING_START',
              currentStepIndex: 0,
              questionCount: 0,
              lastQuestionTime: null,
              skippedActivities: [],
              failedAttempts: 0,
              totalWrongAnswers: 0,
              savedStepIndex: undefined,
              doubtContext: undefined,
            },
          };
        }
        return Promise.resolve(sessionState);
      });
      mockSessionRepo.updateStatus.mockImplementation((id, status) => {
        if (id === testSessionId) {
          sessionState.status = status;
        }
        return Promise.resolve(undefined);
      });
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(null);

      result = await orchestrator.start(recipeId, studentId);

      await orchestrator.interact(testSessionId, 'ok', studentId); // AWAITING_START -> EXPLANATION (intro)
      await orchestrator.interact(testSessionId, 'continuar', studentId); // EXPLANATION (intro) -> EXPLANATION (content 1)
      await orchestrator.interact(testSessionId, 'continuar', studentId); // EXPLANATION (content 1) -> EXPLANATION (content 2)
      result = await orchestrator.interact(testSessionId, 'continuar', studentId); // EXPLANATION (content 2) -> ACTIVITY_WAIT (question)

      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');
      expect(result.staticContent.activity.instruction).toBe('What is the capital of France?');

      // Answer incorrectly twice to trigger ACTIVITY_SKIP_OFFER if configured, then repeat
      studentInput = 'London';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'incorrect',
        confidence: 0.8,
        hint: 'It starts with P',
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);
      expect(result.pedagogicalState).toBe('EVALUATION');

      studentInput = 'Berlin';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'incorrect',
        confidence: 0.7,
        hint: 'Think of France',
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);
      // Since skipAfterFailedAttempts is 2, after 2 incorrect attempts, it goes to ACTIVITY_SKIP_OFFER
      expect(result.pedagogicalState).toBe('ACTIVITY_SKIP_OFFER');

      // Request to repeat
      studentInput = 'repetir';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION'); // should go back to previous content step (index 2)
      expect(result.staticContent.script.content).toContain('This is the second content step.');
      expect(result.lessonProgress.currentStep).toBe(2);

      // Now, try to complete the question again
      result = await orchestrator.interact(testSessionId, 'continuar', studentId);
      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');
      expect(result.staticContent.activity.instruction).toBe('What is the capital of France?');
      expect(result.lessonProgress.currentStep).toBe(3);

      studentInput = 'Paris';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'correct',
        confidence: 0.9,
        hint: null,
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);
      expect(result.pedagogicalState).toBe('EVALUATION');
      expect(result.voiceText).toBe('Correct!');
      expect(result.isCorrect).toBe(true);

      // Continue to the next content step
      result = await orchestrator.interact(testSessionId, 'continuar', studentId);
      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.script.content).toContain(
        'This content comes after the question.',
      );
      expect(result.lessonProgress.currentStep).toBe(4);

      // We've demonstrated the repeat mechanism, no need to validate the full flow here again
    });

    it('should skip an activity if requested from ACTIVITY_SKIP_OFFER state', async () => {
      let result: any;
      let studentInput: string;
      const testSessionId = randomUUID();

      // --- Session State Management for this test ---
      let sessionState: Session = {
        id: testSessionId,
        studentId: studentId,
        recipeId: recipeId,
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
      mockSessionRepo.resetProgress.mockImplementation((id) => {
        if (id === testSessionId) {
          sessionState = {
            ...sessionState,
            status: 'IDLE',
            stateCheckpoint: {
              currentState: 'AWAITING_START',
              currentStepIndex: 0,
              questionCount: 0,
              lastQuestionTime: null,
              skippedActivities: [],
              failedAttempts: 0,
              totalWrongAnswers: 0,
              savedStepIndex: undefined,
              doubtContext: undefined,
            },
          };
        }
        return Promise.resolve(sessionState);
      });
      mockSessionRepo.updateStatus.mockImplementation((id, status) => {
        if (id === testSessionId) {
          sessionState.status = status;
        }
        return Promise.resolve(undefined);
      });
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(null);

      result = await orchestrator.start(recipeId, studentId);

      await orchestrator.interact(testSessionId, 'ok', studentId); // AWAITING_START -> EXPLANATION (intro)
      await orchestrator.interact(testSessionId, 'continuar', studentId); // EXPLANATION (intro) -> EXPLANATION (content 1)
      await orchestrator.interact(testSessionId, 'continuar', studentId); // EXPLANATION (content 1) -> EXPLANATION (content 2)
      result = await orchestrator.interact(testSessionId, 'continuar', studentId); // EXPLANATION (content 2) -> ACTIVITY_WAIT (question)

      expect(result.pedagogicalState).toBe('ACTIVITY_WAIT');

      // Answer incorrectly twice to trigger ACTIVITY_SKIP_OFFER
      studentInput = 'incorrect-answer-1';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'incorrect',
        confidence: 0.8,
        hint: 'Hint',
      });
      await orchestrator.interact(testSessionId, studentInput, studentId);

      studentInput = 'incorrect-answer-2';
      mockComprehensionEvaluator.evaluate.mockResolvedValueOnce({
        result: 'incorrect',
        confidence: 0.7,
        hint: 'Another Hint',
      });
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('ACTIVITY_SKIP_OFFER');

      // Skip the activity
      studentInput = 'saltar';
      result = await orchestrator.interact(testSessionId, studentInput, studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION'); // Should move to next content step
      expect(result.staticContent.script.content).toContain(
        'This content comes after the question.',
      );
      expect(result.lessonProgress.currentStep).toBe(4); // Skipped step 3 (question) and moved to step 4 (content)

      // Verify that step 3's atomId was added to skippedActivities
      const sessionAfterSkip = await mockSessionRepo.findById(testSessionId);
      expect(sessionAfterSkip.stateCheckpoint.skippedActivities).toContain(
        testRecipeSteps[3].atomId,
      );
    });

    it('should correctly resume an existing active session', async () => {
      const testSessionId = randomUUID();
      const existingSession: Session = {
        id: testSessionId,
        studentId: studentId,
        recipeId: recipeId,
        status: 'ACTIVE',
        stateCheckpoint: {
          currentState: 'EXPLANATION',
          currentStepIndex: 1, // Already past intro, at first content step
          questionCount: 0,
          lastQuestionTime: null,
          skippedActivities: [],
          failedAttempts: 0,
          totalWrongAnswers: 0,
          savedStepIndex: undefined,
          doubtContext: undefined,
        },
      };
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(existingSession);
      // Ensure findById also returns the existing session when requested by orchestrator.start
      mockSessionRepo.findById.mockImplementation((id: string) => {
        if (id === existingSession.id) {
          return Promise.resolve(existingSession);
        }
        return Promise.resolve(null);
      });

      const result = await orchestrator.start(recipeId, studentId);

      expect(result.resumed).toBe(true);
      expect(result.voiceText).toContain(
        '¡Bienvenido de vuelta, Test Student! Continuemos con Test Recipe.',
      );
      expect(result.pedagogicalState).toBe('EXPLANATION');
      expect(result.staticContent.stepType).toBe('content');
      expect(result.staticContent.script.content).toContain('This is the first content step.');
      expect(result.lessonProgress.currentStep).toBe(1);
    });

    it('should correctly reset and reuse a completed session', async () => {
      const testSessionId = randomUUID();
      let completedSessionState: Session = {
        id: testSessionId,
        studentId: studentId,
        recipeId: recipeId,
        status: 'COMPLETED',
        stateCheckpoint: {
          currentState: 'COMPLETED',
          currentStepIndex: testRecipeSteps.length - 1,
          questionCount: 1,
          lastQuestionTime: '2023-01-01T10:00:00.000Z',
          skippedActivities: ['some-atom-id'],
          failedAttempts: 1,
          totalWrongAnswers: 2,
          savedStepIndex: undefined,
          doubtContext: undefined,
        },
      };
      // Mock findByStudentAndRecipe to return the completed session
      mockSessionRepo.findByStudentAndRecipe.mockResolvedValueOnce(completedSessionState);
      // Ensure findById returns the completed session when requested, or the reset state later
      mockSessionRepo.findById.mockImplementation((id: string) => {
        if (id === testSessionId) {
          return Promise.resolve(completedSessionState);
        }
        return Promise.resolve(null);
      });
      // Mock resetProgress to update the internal state
      mockSessionRepo.resetProgress.mockImplementation((id) => {
        if (id === testSessionId) {
          completedSessionState = {
            ...completedSessionState,
            status: 'IDLE',
            stateCheckpoint: {
              currentState: 'AWAITING_START',
              currentStepIndex: 0,
              questionCount: 0,
              lastQuestionTime: null,
              skippedActivities: [],
              failedAttempts: 0,
              totalWrongAnswers: 0,
              savedStepIndex: undefined,
              doubtContext: undefined,
            },
          };
        }
        return Promise.resolve(completedSessionState);
      });
      // Mock updateStatus to update the internal state
      mockSessionRepo.updateStatus.mockImplementation((id, status) => {
        if (id === testSessionId) {
          completedSessionState.status = status;
        }
        return Promise.resolve(undefined);
      });

      const result = await orchestrator.start(recipeId, studentId);

      expect(result.resumed).toBe(false);
      expect(result.isRepeat).toBe(true);
      expect(result.voiceText).toContain('Hello Test Student, welcome to Test Recipe!');
      expect(result.pedagogicalState).toBe('AWAITING_START');
      expect(result.staticContent.stepType).toBe('intro');
      expect(result.lessonProgress.currentStep).toBe(0);
      expect(mockInteractionRepo.deleteBySession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionRepo.resetProgress).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionRepo.updateStatus).toHaveBeenCalledWith(testSessionId, 'ACTIVE');
      expect(mockInteractionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: expect.stringContaining('Hello Test Student'),
          aiResponse: {
            text: expect.stringContaining('Hello Test Student'),
            responseType: 'greeting',
          },
        }),
      );
    });
  });
});
