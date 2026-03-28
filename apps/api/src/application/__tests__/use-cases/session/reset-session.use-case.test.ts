import { ResetSessionUseCase } from '../../../use-cases/session/reset-session.use-case';
import type { SessionRepository } from '../../../../domain/ports/session-repository';

describe('ResetSessionUseCase', () => {
  let mockSessionRepo: jest.Mocked<SessionRepository>;
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

    useCase = new ResetSessionUseCase(mockSessionRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should throw error if session does not exist', async () => {
      mockSessionRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(sessionId)).rejects.toThrow();
    });

    it('should reset session and update status to ACTIVE', async () => {
      mockSessionRepo.findById.mockResolvedValue(mockSession);
      mockSessionRepo.resetProgress.mockResolvedValue(mockResetSession);
      mockSessionRepo.updateStatus.mockResolvedValue({
        ...mockResetSession,
        status: 'ACTIVE',
      } as any);

      const result = await useCase.execute(sessionId);

      expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
      expect(mockSessionRepo.resetProgress).toHaveBeenCalledWith(sessionId);
      expect(mockSessionRepo.updateStatus).toHaveBeenCalledWith(resetSessionId, 'ACTIVE');
      // Verify it returns a valid session object
      expect(result.id).toBe(resetSessionId);
      expect(result.status).toBe('ACTIVE');
      expect(result.stateCheckpoint.currentStepIndex).toBe(0);
    });

    it('should propagate resetProgress errors', async () => {
      mockSessionRepo.findById.mockResolvedValue(mockSession);
      mockSessionRepo.resetProgress.mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute(sessionId)).rejects.toThrow('DB error');
    });
  });
});
