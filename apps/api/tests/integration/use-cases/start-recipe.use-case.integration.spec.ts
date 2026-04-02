/**
 * Integration Tests for StartRecipeUseCase
 *
 * Coverage:
 * - Session creation flow
 * - Resumption of non-terminal sessions
 * - Handling of terminal sessions (completed/escalated)
 * - Recipe not found errors
 * - Session state initialization
 */

import { randomUUID } from 'node:crypto';
import { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case';
import { RecipeNotFoundError } from '@/features/recipe/domain/ports/recipe.repository.port';
import type { Session } from '@/features/session/domain/entities/session.entity';

// =============== Helpers ===============

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
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// =============== Mocks ===============

const mockSessionRepo = (): any => ({
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

const mockRecipeRepo = (): any => ({
  findById: jest.fn(),
  findStepsByRecipeId: jest.fn(),
});

// =============== Tests ===============

describe('StartRecipeUseCase - Integration', () => {
  let useCase: StartRecipeUseCase;
  let sessionRepo: any;
  let recipeRepo: any;

  const recipeId = uuid();
  const studentId = uuid();

  beforeEach(() => {
    sessionRepo = mockSessionRepo();
    recipeRepo = mockRecipeRepo();
    useCase = new StartRecipeUseCase(recipeRepo, sessionRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    it('creates new session successfully', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);

      const result = await useCase.execute(recipeId, studentId);

      expect(result.sessionId).toBeDefined();
      expect(result.resumed).toBe(false);
      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId,
          recipeId,
          status: 'ACTIVE',
        }),
      );
    });

    it('resumes active session', async () => {
      const recipe = makeRecipe({ id: recipeId });
      const existing = makeSession({
        id: uuid(),
        studentId,
        recipeId,
        status: 'ACTIVE',
        stateCheckpoint: { currentState: 'ACTIVE_CLASS', currentStepIndex: 0 },
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(existing);

      const result = await useCase.execute(recipeId, studentId);

      expect(result.sessionId).toBe(existing.id);
      expect(result.resumed).toBe(true);
      expect(sessionRepo.create).not.toHaveBeenCalled();
    });

    it('resumes IDLE session', async () => {
      const recipe = makeRecipe({ id: recipeId });
      const existing = makeSession({
        studentId,
        recipeId,
        status: 'IDLE',
        stateCheckpoint: { currentState: 'AWAITING_START', currentStepIndex: 0 },
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(existing);

      const result = await useCase.execute(recipeId, studentId);

      expect(result.resumed).toBe(true);
      expect(result.sessionId).toBe(existing.id);
    });

    it('resumes PAUSED_FOR_QUESTION session', async () => {
      const recipe = makeRecipe({ id: recipeId });
      const existing = makeSession({
        studentId,
        recipeId,
        status: 'PAUSED_FOR_QUESTION',
        stateCheckpoint: { currentState: 'RESOLVING_DOUBT', currentStepIndex: 2 },
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(existing);

      const result = await useCase.execute(recipeId, studentId);

      expect(result.resumed).toBe(true);
    });

    it('creates new session when existing is COMPLETED', async () => {
      const recipe = makeRecipe({ id: recipeId });
      const completed = makeSession({
        studentId,
        recipeId,
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(completed);

      const result = await useCase.execute(recipeId, studentId);

      expect(sessionRepo.create).toHaveBeenCalled();
      expect(result.resumed).toBe(false);
    });

    it('creates new session when existing is ESCALATED', async () => {
      const recipe = makeRecipe({ id: recipeId });
      const escalated = makeSession({
        studentId,
        recipeId,
        status: 'ESCALATED',
        escalatedAt: new Date(),
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(escalated);

      const result = await useCase.execute(recipeId, studentId);

      expect(sessionRepo.create).toHaveBeenCalled();
      expect(result.resumed).toBe(false);
    });

    it('throws RecipeNotFoundError when recipe missing', async () => {
      recipeRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(recipeId, studentId)).rejects.toThrow(RecipeNotFoundError);
    });

    it('generates unique session IDs', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);

      const result1 = await useCase.execute(recipeId, studentId);
      const result2 = await useCase.execute(recipeId, studentId);

      expect(result1.sessionId).not.toBe(result2.sessionId);
    });

    it('sets session status to ACTIVE on creation', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);

      await useCase.execute(recipeId, studentId);

      const createdSession = sessionRepo.create.mock.calls[0][0];
      expect(createdSession.status).toBe('ACTIVE');
    });

    it('initializes checkpoint with AWAITING_START', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);

      await useCase.execute(recipeId, studentId);

      const createdSession = sessionRepo.create.mock.calls[0][0];
      expect(createdSession.stateCheckpoint.currentState).toBe('AWAITING_START');
      expect(createdSession.stateCheckpoint.currentStepIndex).toBe(0);
    });

    it('includes correct studentId and recipeId in created session', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);

      await useCase.execute(recipeId, studentId);

      const createdSession = sessionRepo.create.mock.calls[0][0];
      expect(createdSession.studentId).toBe(studentId);
      expect(createdSession.recipeId).toBe(recipeId);
    });

    it('does not create session if recipe not found', async () => {
      recipeRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(recipeId, studentId)).rejects.toThrow(RecipeNotFoundError);
      expect(sessionRepo.create).not.toHaveBeenCalled();
    });

    it('handles database errors gracefully', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute(recipeId, studentId)).rejects.toThrow('DB error');
    });

    it('returns same session ID when resuming', async () => {
      const recipe = makeRecipe({ id: recipeId });
      const existingId = uuid();
      const existing = makeSession({
        id: existingId,
        studentId,
        recipeId,
        status: 'ACTIVE',
      });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(existing);

      const result = await useCase.execute(recipeId, studentId);

      expect(result.sessionId).toBe(existingId);
    });

    it('sets timestamps on new session', async () => {
      const recipe = makeRecipe({ id: recipeId });
      recipeRepo.findById.mockResolvedValue(recipe);
      sessionRepo.findByStudentAndRecipe.mockResolvedValue(null);

      await useCase.execute(recipeId, studentId);

      const createdSession = sessionRepo.create.mock.calls[0][0];
      expect(createdSession.startedAt).toBeInstanceOf(Date);
      expect(createdSession.lastActivityAt).toBeInstanceOf(Date);
    });
  });
});
