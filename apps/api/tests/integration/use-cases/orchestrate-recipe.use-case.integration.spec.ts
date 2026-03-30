/**
 * Integration Tests for OrchestrateRecipeUseCase
 *
 * Covers:
 * - start(): new session, resume, terminal handling
 * - interact(): state transitions, questions, activities, completion
 * - Error handling
 */

import { randomUUID } from 'node:crypto';
import { OrchestrateRecipeUseCase } from '@/application/use-cases/recipe/orchestrate-recipe.use-case';
import type { Session } from '@/domain/entities/session';

// =============== Factories ===============

const uuid = () => randomUUID();

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: uuid(),
  studentId: uuid(),
  recipeId: uuid(),
  status: 'IDLE',
  stateCheckpoint: {
    currentState: 'ACTIVE_CLASS',
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
  safetyFlag: null,
  outOfScope: false,
  failedAttempts: 0,
  ...overrides,
});

const makeRecipe = (overrides: Partial<any> = {}): any => ({
  id: uuid(),
  canonicalId: uuid(),
  title: 'Recipe',
  description: '',
  expectedDurationMinutes: 30,
  version: '1.0.0',
  published: true,
  moduleId: undefined,
  steps: [],
  meta: {},
  ...overrides,
});

const makeStep = (overrides: Partial<any> = {}): any => ({
  id: uuid(),
  recipeId: uuid(),
  atomId: uuid(),
  order: 0,
  createdAt: new Date(),
  stepType: 'content',
  ...overrides,
});

const makeAtom = (overrides: Partial<any> = {}): any => ({
  id: uuid(),
  canonicalId: uuid(),
  title: 'Atom',
  type: 'MICROLECTURE',
  locale: 'es-AR',
  difficulty: 1,
  version: '1.0.0',
  published: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  content: 'Content',
  ...overrides,
});

// =============== Mocks ===============

const createEmptyMock = (): any => ({});

const createSessionRepo = (): any => ({
  findById: jest.fn(),
  findByStudentAndRecipe: jest.fn(),
  findByStudent: jest.fn(),
  findActiveByStudent: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  updateCheckpoint: jest.fn(),
  complete: jest.fn(),
  resetProgress: jest.fn(),
  escalate: jest.fn(),
  incrementFailedAttempts: jest.fn(),
});

const createInteractionRepo = (): any => ({
  findById: jest.fn(),
  findBySession: jest.fn(),
  findBySessionOrdered: jest.fn(),
  create: jest.fn(),
  deleteBySession: jest.fn(),
});

const createRecipeRepo = (): any => ({
  findById: jest.fn(),
  findStepsByRecipeId: jest.fn(),
});

const createAtomRepo = (): any => ({ findById: jest.fn() });
const createUserRepo = (): any => ({ findById: jest.fn() });
const createAIService = (): any => ({ generateResponse: jest.fn() });
const createQuestionClassifier = (): any => ({ classify: jest.fn() });
const createRAGService = (): any => ({ retrieveChunks: jest.fn(), generateEmbedding: jest.fn() });
const createComprehensionEvaluator = (): any => ({ evaluate: jest.fn() });
const createActivityAttemptRepo = (): any => ({ findByUserIdAndAtomId: jest.fn() });
const createFeatureFlagService = (): any => ({ shouldUseNewEngine: jest.fn() });
const createLessonEvaluator = (): any => ({ evaluate: jest.fn() });
const createAdvisoryLockManager = (): any => ({
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
  isLocked: jest.fn(),
});
const createContextWindowService = (): any => ({
  trimHistory: jest.fn().mockReturnValue([]),
  summarizeOlderTurns: jest.fn().mockReturnValue(''),
});

// =============== Tests ===============

describe('OrchestrateRecipeUseCase - Integration', () => {
  let useCase: OrchestrateRecipeUseCase;
  let sessionRepo: any;
  let interactionRepo: any;
  let recipeRepo: any;
  let atomRepo: any;
  let userRepo: any;
  let aiService: any;
  let questionClassifier: any;
  let ragService: any;
  let comprehensionEvaluator: any;
  let lessonEvaluator: any;
  let featureFlagService: any;
  let activityAttemptRepo: any;
  let advisoryLockManager: any;
  let contextWindowService: any;

  const recipeId = uuid();
  const studentId = uuid();
  const sessionId = uuid();

  beforeEach(() => {
    sessionRepo = createSessionRepo();
    interactionRepo = createInteractionRepo();
    recipeRepo = createRecipeRepo();
    atomRepo = createAtomRepo();
    userRepo = createUserRepo();
    aiService = createAIService();
    questionClassifier = createQuestionClassifier();
    ragService = createRAGService();
    comprehensionEvaluator = createComprehensionEvaluator();
    lessonEvaluator = createLessonEvaluator();
    featureFlagService = createFeatureFlagService();
    activityAttemptRepo = createActivityAttemptRepo();
    advisoryLockManager = createAdvisoryLockManager();
    contextWindowService = createContextWindowService();

    userRepo.findById.mockResolvedValue({
      id: studentId,
      name: 'Test Student',
      cohort: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Note: conceptRepo and activityRepo are required but not used; provide empty objects
    useCase = new OrchestrateRecipeUseCase(
      sessionRepo,
      interactionRepo,
      recipeRepo,
      createEmptyMock(), // conceptRepo
      createEmptyMock(), // activityRepo
      atomRepo,
      userRepo,
      aiService,
      questionClassifier,
      ragService,
      comprehensionEvaluator,
      lessonEvaluator,
      advisoryLockManager,
      contextWindowService,
      featureFlagService,
      activityAttemptRepo,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== start() ====================

  describe('start()', () => {
    const recipe = makeRecipe({ id: recipeId, title: 'Test Recipe' });
    const step = makeStep({ recipeId, atomId: uuid(), order: 0 });
    const atom = makeAtom({ id: step.atomId, content: 'Content' });

    it('creates new session', async () => {
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue([step]);
      atomRepo.findById.mockResolvedValue(atom);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Welcome!',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.start(recipeId, studentId);

      expect(result.sessionId).toBeDefined();
      expect(result.voiceText).toContain('¡Hola Test Student!');
      expect(result.pedagogicalState).toBe('AWAITING_START');
      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ studentId, recipeId, status: 'IDLE' }),
      );
    });

    it('resumes active session', async () => {
      const existing = makeSession({
        id: sessionId,
        status: 'ACTIVE',
        stateCheckpoint: { currentState: 'ACTIVE_CLASS', currentStepIndex: 1 },
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue([step, makeStep({ order: 1 })]);
      atomRepo.findById.mockResolvedValue(atom);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(existing);

      const result = await useCase.start(recipeId, studentId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.resumed).toBe(true);
      expect(sessionRepo.create).not.toHaveBeenCalled();
    });

    it('resumes IDLE session', async () => {
      const idle = makeSession({
        status: 'IDLE',
        stateCheckpoint: { currentState: 'AWAITING_START', currentStepIndex: 0 },
        id: sessionId,
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue([step]);
      atomRepo.findById.mockResolvedValue(atom);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(idle);

      const result = await useCase.start(recipeId, studentId);

      expect(result.resumed).toBe(true);
    });

    it('resets COMPLETED session', async () => {
      const completed = makeSession({
        status: 'COMPLETED',
        completedAt: new Date(),
        id: sessionId,
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue([step]);
      atomRepo.findById.mockResolvedValue(atom);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(completed);
      sessionRepo.resetProgress.mockResolvedValue({
        ...completed,
        status: 'IDLE',
        stateCheckpoint: { currentState: 'ACTIVE_CLASS', currentStepIndex: 0 },
      } as any);
      sessionRepo.updateStatus.mockResolvedValue({ ...completed, status: 'ACTIVE' } as any);
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Back',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.start(recipeId, studentId);

      expect(sessionRepo.resetProgress).toHaveBeenCalledWith(completed.id);
      expect(result.isRepeat).toBe(true);
    });

    it('throws RecipeNotFoundError', async () => {
      recipeRepo.findById.mockResolvedValue(null);
      await expect(useCase.start(recipeId, studentId)).rejects.toThrow(
        require('@/domain/ports/recipe-repository').RecipeNotFoundError,
      );
    });

    it('throws when no steps', async () => {
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue([]);
      await expect(useCase.start(recipeId, studentId)).rejects.toThrow('Recipe has no steps');
    });

    it('includes lessonProgress', async () => {
      const steps = [step, makeStep({ order: 1 }), makeStep({ order: 2 })];
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue(steps);
      atomRepo.findById.mockResolvedValue(atom);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Hi',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.start(recipeId, studentId);

      expect(result.lessonProgress).toEqual({ currentStep: 0, totalSteps: 3 });
    });
  });

  // ==================== interact() ====================

  describe('interact()', () => {
    let baseSession: Session;

    beforeEach(() => {
      baseSession = makeSession({
        id: sessionId,
        studentId,
        recipeId,
        status: 'ACTIVE',
        stateCheckpoint: {
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 0,
          questionCount: 0,
          lastQuestionTime: null,
          skippedActivities: [],
          failedAttempts: 0,
          totalWrongAnswers: 0,
        },
      });
    });

    const setup = (
      session: Session,
      recipe: any,
      steps: any[],
      atom: any,
      interactions: any[] = [],
    ) => {
      sessionRepo.findById.mockResolvedValue(session);
      recipeRepo.findById.mockResolvedValue(recipe);
      recipeRepo.findStepsByRecipeId.mockResolvedValue(steps);
      atomRepo.findById.mockResolvedValue(atom);
      interactionRepo.findBySessionOrdered.mockResolvedValue(interactions);
    };

    it('throws SessionNotFoundError', async () => {
      sessionRepo.findById.mockResolvedValue(null);
      await expect(useCase.interact(sessionId, 'hello', studentId)).rejects.toThrow(
        require('@/domain/ports/session-repository').SessionNotFoundError,
      );
    });

    it('throws 403 for wrong user', async () => {
      const s = { ...baseSession, studentId: 'other' };
      sessionRepo.findById.mockResolvedValue(s);
      await expect(useCase.interact(sessionId, 'hello', studentId)).rejects.toThrow('Forbidden');
    });

    it('throws if session not ACTIVE or IDLE', async () => {
      const s = { ...baseSession, status: 'COMPLETED' as const };
      sessionRepo.findById.mockResolvedValue(s);
      await expect(useCase.interact(sessionId, 'hello')).rejects.toThrow('Session not active');
    });

    it('throws RecipeNotFoundError', async () => {
      sessionRepo.findById.mockResolvedValue(baseSession);
      recipeRepo.findById.mockResolvedValue(null);
      await expect(useCase.interact(sessionId, 'hi', studentId)).rejects.toThrow(
        require('@/domain/ports/recipe-repository').RecipeNotFoundError,
      );
    });

    it('AWAITING_START ready -> ACTIVE_CLASS', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: { ...baseSession.stateCheckpoint, currentState: 'AWAITING_START' },
      };
      const recipe = makeRecipe();
      const step = makeStep({ stepType: 'content' });
      const atom = makeAtom({});
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Content',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.interact(sessionId, 'sí', studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
    });

    it('advances step in ACTIVE_CLASS', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 0,
        },
      };
      const recipe = makeRecipe();
      const step1 = makeStep({ order: 0, atomId: uuid() });
      const step2 = makeStep({ order: 1, atomId: uuid() });
      const atom = makeAtom({ id: step1.atomId });
      setup(session, recipe, [step1, step2], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Next',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      await useCase.interact(sessionId, 'continue', studentId);

      expect(sessionRepo.updateCheckpoint).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({ currentStepIndex: 1 }),
      );
    });

    it('completes session at last step', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 0,
        },
      };
      const recipe = makeRecipe();
      const step = makeStep({ atomId: uuid() });
      const atom = makeAtom({ id: step.atomId });
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Done',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.interact(sessionId, 'continue', studentId);

      expect(result.sessionCompleted).toBe(true);
      expect(sessionRepo.complete).toHaveBeenCalledWith(sessionId);
    });

    it('question correct -> EVALUATION', async () => {
      const qScript = {
        kind: 'question',
        question: { text: '2+2?' },
        expectedAnswer: '4',
        feedback: { correct: 'Yes!', incorrect: 'No' },
      };
      const step = makeStep({ stepType: 'question', script: qScript as any, atomId: uuid() });
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: 0,
        },
      };
      const recipe = makeRecipe();
      const atom = makeAtom({ id: step.atomId });
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      comprehensionEvaluator.evaluate.mockResolvedValue({ result: 'correct', confidence: 0.95 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Correct!',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.interact(sessionId, '4', studentId);

      expect(result.isCorrect).toBe(true);
      expect(sessionRepo.incrementFailedAttempts).not.toHaveBeenCalled();
    });

    it('question incorrect -> increment attempts', async () => {
      const qScript = {
        kind: 'question',
        question: { text: '2+2?' },
        expectedAnswer: '4',
        feedback: { correct: 'Yes!', incorrect: 'No' },
      };
      const step = makeStep({ stepType: 'question', script: qScript as any, atomId: uuid() });
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: 0,
          failedAttempts: 0,
        },
      };
      const recipe = makeRecipe({ meta: { enableActivitySkip: true, skipAfterFailedAttempts: 2 } });
      const atom = makeAtom({ id: step.atomId });
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      comprehensionEvaluator.evaluate.mockResolvedValue({ result: 'incorrect', confidence: 0.3 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Incorrect',
        supportQuotes: [],
        pedagogicalState: 'EVALUATION',
        isCorrect: false,
      });

      const result = await useCase.interact(sessionId, '5', studentId);

      expect(sessionRepo.incrementFailedAttempts).toHaveBeenCalledWith(sessionId);
      expect(result.pedagogicalState).toBe('EVALUATION');
    });

    it('handles MCQ activity correct', async () => {
      const actScript = {
        kind: 'activity',
        instruction: { text: 'Pick' },
        options: [
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false },
        ],
        feedback: { correct: 'Yes!', incorrect: 'No' },
      };
      const step = makeStep({ stepType: 'activity', script: actScript as any, atomId: uuid() });
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVITY_WAIT',
          currentStepIndex: 0,
        },
      };
      const recipe = makeRecipe();
      const atom = makeAtom({ id: step.atomId });
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });

      aiService.generateResponse.mockResolvedValue({
        explanation: 'Correct!',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.interact(sessionId, '4', studentId);

      expect(result.isCorrect).toBe(true);
    });

    it('handles CLARIFYING state', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'CLARIFYING',
          savedStepIndex: 0,
          doubtContext: { question: 'What?', stepIndex: 0 },
        },
      };
      const recipe = makeRecipe();
      const step = makeStep({ stepType: 'content' });
      const atom = makeAtom({});
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.7 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Continuing',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const result = await useCase.interact(sessionId, 'I understand', studentId);

      expect(result.pedagogicalState).toBe('EXPLANATION');
    });

    it('escalates on safetyFlag', async () => {
      const session: Session = {
        ...baseSession,
        safetyFlag: 'inappropriate',
        stateCheckpoint: { ...baseSession.stateCheckpoint, currentState: 'ACTIVE_CLASS' },
      };
      const recipe = makeRecipe();
      const step = makeStep({});
      const atom = makeAtom({});
      setup(session, recipe, [step], atom);

      const result = await useCase.interact(sessionId, 'msg', studentId);

      expect(sessionRepo.escalate).toHaveBeenCalledWith(sessionId);
      expect(result.sessionCompleted).toBe(true);
    });

    it('calls RAG for question in non-ACTIVITY_WAIT', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: { ...baseSession.stateCheckpoint, currentState: 'ACTIVE_CLASS' },
      };
      const step = makeStep({ stepType: 'content', atomId: uuid() });
      const atom = makeAtom({ id: step.atomId });
      const recipe = makeRecipe();
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'question', confidence: 0.8 });
      ragService.retrieveChunks.mockResolvedValue({
        chunks: [],
        totalAvailable: 0,
        retrievalMethod: 'embedding',
      });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Answer',
        supportQuotes: [],
        pedagogicalState: 'RESOLVING_DOUBT',
      });

      ragService.retrieveChunks.mockResolvedValue({
        chunks: [],
        totalAvailable: 0,
        retrievalMethod: 'embedding',
      });

      await useCase.interact(sessionId, 'question?', studentId);

      expect(ragService.retrieveChunks).toHaveBeenCalledWith({
        atomId: atom.id,
        queryText: 'question?',
        k: 3,
      });
    });

    it('records interactions', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: { ...baseSession.stateCheckpoint, currentState: 'ACTIVE_CLASS' },
      };
      const recipe = makeRecipe();
      const step = makeStep({ stepType: 'content' });
      const atom = makeAtom({});
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Response',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      await useCase.interact(sessionId, 'user msg', studentId);

      expect(interactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId, transcript: 'user msg' }),
      );
      expect(interactionRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sessionId,
          transcript: 'Response',
          aiResponse: expect.any(Object),
        }),
      );
    });

    it('handles AI fallback on error', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: { ...baseSession.stateCheckpoint, currentState: 'ACTIVE_CLASS' },
      };
      const recipe = makeRecipe();
      const step = makeStep({ stepType: 'content' });
      const atom = makeAtom({});
      setup(session, recipe, [step], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockRejectedValue(new Error('timeout'));

      const result = await useCase.interact(sessionId, 'hi', studentId);

      expect(result.voiceText).toBe(
        '¡Has terminado la clase de Recipe! ¡Felicitaciones estudiante!',
      );
    });

    it('handles ACTIVITY_SKIP_OFFER skip', async () => {
      const qScript = {
        kind: 'question',
        question: { text: 'Q?' },
        expectedAnswer: 'A',
        feedback: { correct: 'C', incorrect: 'I' },
      };
      const curStep = makeStep({ stepType: 'question', script: qScript as any, atomId: uuid() });
      const nextStep = makeStep({ order: 1, atomId: uuid(), stepType: 'content' });
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVITY_SKIP_OFFER',
          currentStepIndex: 0,
          failedAttempts: 2,
          skippedActivities: [],
        },
      };
      const recipe = makeRecipe({ steps: [curStep, nextStep] });
      const atom = makeAtom({ id: curStep.atomId });
      setup(session, recipe, [curStep, nextStep], atom);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Skipping',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      await useCase.interact(sessionId, 'skip', studentId);

      expect(sessionRepo.updateCheckpoint).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          skippedActivities: [curStep.atomId],
          currentStepIndex: 1,
          failedAttempts: 0,
        }),
      );
    });

    it('handles RESOLVING_DOUBT flow', async () => {
      const session: Session = {
        ...baseSession,
        stateCheckpoint: {
          ...baseSession.stateCheckpoint,
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 2,
        },
      };
      const recipe = makeRecipe();
      const steps = [makeStep({ order: 0 }), makeStep({ order: 1 }), makeStep({ order: 2 })];
      const atom = makeAtom({});
      setup(session, recipe, steps, atom);

      // first: raise question
      questionClassifier.classify.mockResolvedValue({ intent: 'question', confidence: 0.9 });
      ragService.retrieveChunks.mockResolvedValue({
        chunks: [],
        totalAvailable: 0,
        retrievalMethod: 'embedding',
      });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Answer',
        supportQuotes: [],
        pedagogicalState: 'RESOLVING_DOUBT',
      });

      const r1 = await useCase.interact(sessionId, 'doubt', studentId);
      expect(r1.pedagogicalState).toBe('RESOLVING_DOUBT');

      // second: after clarification
      const updatedCp = {
        ...baseSession.stateCheckpoint,
        currentState: 'RESOLVING_DOUBT',
        savedStepIndex: 2,
        doubtContext: { question: 'doubt', stepIndex: 2 },
      };
      sessionRepo.findById.mockResolvedValue({ ...session, stateCheckpoint: updatedCp } as any);

      questionClassifier.classify.mockResolvedValue({ intent: 'answer', confidence: 0.9 });
      aiService.generateResponse.mockResolvedValue({
        explanation: 'Continuing',
        supportQuotes: [],
        pedagogicalState: 'ACTIVE_CLASS',
      });

      const r2 = await useCase.interact(sessionId, 'thanks', studentId);
      expect(r2.pedagogicalState).toBe('EXPLANATION');
    });
  });
});
