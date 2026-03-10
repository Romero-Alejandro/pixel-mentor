import { randomUUID } from 'node:crypto';

import { PrismaSessionRepository } from '@/infrastructure/adapters/database/repositories/session-repository';

// Mock the actual file that the repository imports
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
  handlePrismaError: jest.fn(),
}));

// Import the mocked module
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaSessionRepository', () => {
  let repository: PrismaSessionRepository;

  beforeEach(() => {
    repository = new PrismaSessionRepository();
    jest.clearAllMocks();
  });

  const mockSession = {
    id: randomUUID(),
    studentId: randomUUID(),
    lessonId: randomUUID(),
    status: 'active',
    stateCheckpoint: { currentState: 'EXPLANATION', currentQuestionIndex: 0 },
    currentInteractionId: null,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    completedAt: null,
    escalatedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('findById', () => {
    it('should return session when found', async () => {
      (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce(mockSession);

      const result = await repository.findById(mockSession.id);

      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { id: mockSession.id } });
      expect(result).toEqual(expect.objectContaining({ id: mockSession.id }));
    });

    it('should return null when session not found', async () => {
      (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByStudentAndLesson', () => {
    it('should return session when found', async () => {
      (prisma.session.findFirst as jest.Mock).mockResolvedValueOnce(mockSession);

      const result = await repository.findByStudentAndLesson(
        mockSession.studentId,
        mockSession.lessonId,
      );

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: mockSession.studentId,
          lessonId: mockSession.lessonId,
        },
      });
      expect(result).toEqual(expect.objectContaining({ id: mockSession.id }));
    });

    it('should return null when not found', async () => {
      (prisma.session.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findByStudentAndLesson(
        'non-existent-student',
        'non-existent-lesson',
      );

      expect(result).toBeNull();
    });
  });

  describe('findByStudent', () => {
    it('should return sessions for student', async () => {
      (prisma.session.findMany as jest.Mock).mockResolvedValueOnce([mockSession]);

      const result = await repository.findByStudent(mockSession.studentId);

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: { studentId: mockSession.studentId },
        orderBy: { startedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSession.id);
    });
  });

  describe('findActiveByStudent', () => {
    it('should return active sessions for student', async () => {
      (prisma.session.findMany as jest.Mock).mockResolvedValueOnce([mockSession]);

      const result = await repository.findActiveByStudent(mockSession.studentId);

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: {
          studentId: mockSession.studentId,
          status: { in: ['active', 'paused_for_question', 'awaiting_confirmation', 'paused_idle'] },
        },
        orderBy: { lastActivityAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const newSessionId = randomUUID();
      const newSessionData = {
        id: newSessionId,
        studentId: mockSession.studentId,
        lessonId: mockSession.lessonId,
        status: 'idle' as const,
        stateCheckpoint: { currentState: 'EXPLANATION', currentQuestionIndex: 0 },
        currentInteractionId: null,
        lastActivityAt: new Date(),
        completedAt: null,
        escalatedAt: null,
      };

      (prisma.session.create as jest.Mock).mockResolvedValueOnce(mockSession);

      const result = await repository.create(newSessionData);

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: newSessionId,
          studentId: newSessionData.studentId,
          lessonId: newSessionData.lessonId,
          status: 'idle',
        }),
      });
      expect(result.id).toBe(mockSession.id);
    });
  });

  describe('updateStatus', () => {
    it('should update session status', async () => {
      const updatedSession = { ...mockSession, status: 'completed' };
      (prisma.session.update as jest.Mock).mockResolvedValueOnce(updatedSession);

      const result = await repository.updateStatus(mockSession.id, 'completed');

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { status: 'completed' },
      });
      expect(result.status).toBe('completed');
    });
  });

  describe('updateCheckpoint', () => {
    it('should update session checkpoint', async () => {
      const checkpoint = { currentState: 'QUESTION', currentQuestionIndex: 1 };
      const updatedSession = { ...mockSession, stateCheckpoint: checkpoint };
      (prisma.session.update as jest.Mock).mockResolvedValueOnce(updatedSession);

      const result = await repository.updateCheckpoint(mockSession.id, checkpoint);

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { stateCheckpoint: checkpoint },
      });
      expect(result.stateCheckpoint).toEqual(checkpoint);
    });
  });

  describe('complete', () => {
    it('should complete a session', async () => {
      const existingSession = { ...mockSession, status: 'active' };
      const completedSession = { ...mockSession, status: 'completed', completedAt: new Date() };

      (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce(existingSession);
      (prisma.session.update as jest.Mock).mockResolvedValueOnce(completedSession);

      const result = await repository.complete(mockSession.id);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('completed');
    });

    it('should throw error if session not found', async () => {
      (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(repository.complete('non-existent-id')).rejects.toThrow('not found');
    });

    it('should throw error if session already completed', async () => {
      const completedSession = { ...mockSession, status: 'completed' };
      (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce(completedSession);

      await expect(repository.complete(mockSession.id)).rejects.toThrow('already completed');
    });
  });

  describe('escalate', () => {
    it('should escalate a session', async () => {
      const escalatedSession = { ...mockSession, status: 'escalated', escalatedAt: new Date() };
      (prisma.session.update as jest.Mock).mockResolvedValueOnce(escalatedSession);

      const result = await repository.escalate(mockSession.id);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'escalated',
            escalatedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.status).toBe('escalated');
    });
  });

  describe('incrementVersion', () => {
    it('should increment session version', async () => {
      const updatedSession = { ...mockSession, version: 2 };
      (prisma.session.update as jest.Mock).mockResolvedValueOnce(updatedSession);

      const result = await repository.incrementVersion(mockSession.id);

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { version: { increment: 1 } },
        }),
      );
      expect(result.version).toBe(2);
    });
  });
});
