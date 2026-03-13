import { ResetSessionUseCase } from '../../../use-cases/session/reset-session.use-case';
import type { SessionRepository } from '../../../../domain/ports/session-repository';
import type { InteractionRepository } from '../../../../domain/ports/interaction-repository';

describe('ResetSessionUseCase', () => {
  let mockSessionRepo: jest.Mocked<SessionRepository>;
  let mockInteractionRepo: jest.Mocked<InteractionRepository>;
  let useCase: ResetSessionUseCase;

  const sessionId = 'session-123';
  const resetSessionId = 'reset-session-123';

  const mockSession = {
    id: sessionId,
    studentId: 'student-456',
    recipeId: 'recipe-789',
    status: 'active',
    stateCheckpoint: {
      currentState: 'ACTIVE_CLASS',
      currentStepIndex: 2,
    },
    currentInteractionId: null,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    completedAt: null,
    escalatedAt: null,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    safetyFlag: null,
    outOfScope: false,
    failedAttempts: 0,
  } as any;

  const mockResetSession = {
    ...mockSession,
    id: resetSessionId,
    stateCheckpoint: {
      currentState: 'ACTIVE_CLASS',
      currentStepIndex: 0,
    },
    status: 'idle',
  } as any;

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
      resetProgress: jest.fn(),
      incrementFailedAttempts: jest.fn(),
    };
    mockInteractionRepo = {
      findById: jest.fn(),
      findBySession: jest.fn(),
      findBySessionOrdered: jest.fn(),
      create: jest.fn(),
      addAIResponse: jest.fn(),
      confirmComprehension: jest.fn(),
      flagForReview: jest.fn(),
      markAsQuestion: jest.fn(),
      getLatestBySession: jest.fn(),
    };

    useCase = new ResetSessionUseCase(mockSessionRepo, mockInteractionRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should throw error if session does not exist', async () => {
      mockSessionRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(sessionId)).rejects.toThrow();
    });

    it('should reset session and create audit interaction', async () => {
      mockSessionRepo.findById.mockResolvedValue(mockSession);
      mockSessionRepo.resetProgress.mockResolvedValue(mockResetSession);
      mockInteractionRepo.create.mockResolvedValue({
        id: 'interaction-123',
        sessionId: resetSessionId,
        turnNumber: 0,
        transcript: 'Session reset by user',
        aiResponse: null,
        pausedForQuestion: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await useCase.execute(sessionId);

      expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
      expect(mockSessionRepo.resetProgress).toHaveBeenCalledWith(sessionId);
      expect(mockInteractionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          transcript: 'Session reset by user',
          turnNumber: 0,
        }),
      );
      expect(result).toEqual({
        message: 'Session reset to segment 1',
        sessionId: resetSessionId,
        resetToSegment: 1,
      });
    });

    it('should propagate resetProgress errors', async () => {
      mockSessionRepo.findById.mockResolvedValue(mockSession);
      mockSessionRepo.resetProgress.mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute(sessionId)).rejects.toThrow('DB error');
    });
  });
});
