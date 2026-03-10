import type { Prisma } from '../client.js';
import { prisma } from '../client.js';
import { handlePrismaError } from '../error-handler.js';

import type { Session, SessionStatus } from '@/domain/entities/session';
import type { SessionRepository } from '@/domain/ports/session-repository';
import {
  SessionNotFoundError,
  SessionAlreadyCompletedError,
} from '@/domain/ports/session-repository';

type PrismaSession = NonNullable<Awaited<ReturnType<typeof prisma.session.findUnique>>>;

const mapSessionToDomain = (entity: PrismaSession): Session => ({
  id: entity.id,
  studentId: entity.studentId,
  lessonId: entity.lessonId,
  status: entity.status as SessionStatus,
  stateCheckpoint: entity.stateCheckpoint as Record<string, unknown>,
  currentInteractionId: entity.currentInteractionId,
  startedAt: entity.startedAt,
  lastActivityAt: entity.lastActivityAt,
  completedAt: entity.completedAt,
  escalatedAt: entity.escalatedAt,
  version: entity.version,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

export class PrismaSessionRepository implements SessionRepository {
  async findById(id: string): Promise<Session | null> {
    const session = await prisma.session.findUnique({ where: { id } });
    return session ? mapSessionToDomain(session) : null;
  }

  async findByStudentAndLesson(studentId: string, lessonId: string): Promise<Session | null> {
    const session = await prisma.session.findFirst({
      where: { studentId, lessonId },
    });
    return session ? mapSessionToDomain(session) : null;
  }

  async findByStudent(studentId: string): Promise<Session[]> {
    const sessions = await prisma.session.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
    });
    return sessions.map(mapSessionToDomain);
  }

  async findActiveByStudent(studentId: string): Promise<Session[]> {
    const sessions = await prisma.session.findMany({
      where: {
        studentId,
        status: { in: ['active', 'paused_for_question', 'awaiting_confirmation', 'paused_idle'] },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return sessions.map(mapSessionToDomain);
  }

  async create(
    session: Omit<Session, 'startedAt' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<Session> {
    const created = await prisma.session.create({
      data: {
        id: session.id,
        studentId: session.studentId,
        lessonId: session.lessonId,
        status: session.status,
        stateCheckpoint: session.stateCheckpoint as Prisma.InputJsonValue,
        currentInteractionId: session.currentInteractionId,
        lastActivityAt: session.lastActivityAt,
        completedAt: session.completedAt,
        escalatedAt: session.escalatedAt,
      },
    });
    return mapSessionToDomain(created);
  }

  async updateStatus(sessionId: string, status: SessionStatus): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { status },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }

  async updateCheckpoint(sessionId: string, checkpoint: Record<string, unknown>): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { stateCheckpoint: checkpoint as Prisma.InputJsonValue },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }

  async setCurrentInteraction(sessionId: string, interactionId: string | null): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { currentInteractionId: interactionId },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }

  async complete(sessionId: string): Promise<Session> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });

    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status === 'completed') throw new SessionAlreadyCompletedError(sessionId);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return mapSessionToDomain(updated);
  }

  async escalate(sessionId: string): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'escalated',
          escalatedAt: new Date(),
        },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }

  async incrementVersion(sessionId: string): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { version: { increment: 1 } },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }
}
