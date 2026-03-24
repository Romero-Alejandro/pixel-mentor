import type { Prisma } from '../client.js';
import { prisma } from '../client.js';
import { handlePrismaError } from '../error-handler.js';

import type { Session, SessionStatus, SessionCheckpoint } from '@/domain/entities/session';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state';
import type { SessionRepository } from '@/domain/ports/session-repository';
import {
  SessionNotFoundError,
  SessionAlreadyCompletedError,
} from '@/domain/ports/session-repository';

type PrismaSession = NonNullable<Awaited<ReturnType<typeof prisma.session.findUnique>>>;

function serializeCheckpoint(checkpoint: SessionCheckpoint): Prisma.InputJsonValue {
  return {
    currentState: checkpoint.currentState,
    currentStepIndex: checkpoint.currentStepIndex,
    savedStepIndex: checkpoint.savedStepIndex ?? null,
    doubtContext: checkpoint.doubtContext
      ? {
          question: checkpoint.doubtContext.question,
          stepIndex: checkpoint.doubtContext.stepIndex,
        }
      : null,
    questionCount: checkpoint.questionCount ?? 0,
    lastQuestionTime: checkpoint.lastQuestionTime ?? null,
    skippedActivities: checkpoint.skippedActivities ?? [],
    failedAttempts: checkpoint.failedAttempts ?? 0,
    totalWrongAnswers: checkpoint.totalWrongAnswers ?? 0,
  } as Prisma.InputJsonValue;
}

function normalizeCheckpoint(raw: Record<string, unknown> | null | undefined): SessionCheckpoint {
  const data = raw ?? {};
  return {
    currentState: (data.currentState as PedagogicalState) ?? 'ACTIVE_CLASS',
    currentStepIndex: Number(data.currentStepIndex ?? 0),
    savedStepIndex: data.savedStepIndex ? Number(data.savedStepIndex) : undefined,
    doubtContext: data.doubtContext
      ? (() => {
          const ctx = data.doubtContext as any;
          return {
            question: ctx.question,
            stepIndex: Number(ctx.stepIndex),
          };
        })()
      : undefined,
    questionCount: data.questionCount ? Number(data.questionCount) : undefined,
    lastQuestionTime: (data.lastQuestionTime as string) ?? undefined,
    skippedActivities: Array.isArray(data.skippedActivities)
      ? (data.skippedActivities as string[])
      : undefined,
    failedAttempts: data.failedAttempts ? Number(data.failedAttempts) : undefined,
    totalWrongAnswers: data.totalWrongAnswers ? Number(data.totalWrongAnswers) : undefined,
  };
}

const mapSessionToDomain = (entity: PrismaSession): Session => ({
  id: entity.id,
  studentId: entity.studentId,
  recipeId: entity.recipeId,
  status: entity.status as SessionStatus,
  stateCheckpoint: normalizeCheckpoint(entity.stateCheckpoint as Record<string, unknown>),
  startedAt: entity.startedAt,
  lastActivityAt: entity.lastActivityAt,
  completedAt: entity.completedAt,
  escalatedAt: entity.escalatedAt,
  meta: entity.meta ?? undefined,
  failedAttempts: entity.failedAttempts ?? undefined,
});

export class PrismaSessionRepository implements SessionRepository {
  async findById(id: string): Promise<Session | null> {
    const session = await prisma.session.findUnique({ where: { id } });
    return session ? mapSessionToDomain(session) : null;
  }

  async findByStudentAndRecipe(studentId: string, recipeId: string): Promise<Session | null> {
    const session = await prisma.session.findFirst({
      where: { studentId, recipeId },
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
        status: { in: ['ACTIVE', 'PAUSED_FOR_QUESTION', 'AWAITING_CONFIRMATION', 'PAUSED_IDLE'] },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return sessions.map(mapSessionToDomain);
  }

  async create(
    session: Omit<Session, 'startedAt' | 'lastActivityAt' | 'completedAt' | 'escalatedAt' | 'meta'>,
  ): Promise<Session> {
    const now = new Date();
    const created = await prisma.session.create({
      data: {
        id: session.id,
        studentId: session.studentId,
        recipeId: session.recipeId,
        status: session.status,
        stateCheckpoint: serializeCheckpoint(session.stateCheckpoint),
        startedAt: now,
        lastActivityAt: now,
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

  async updateCheckpoint(sessionId: string, checkpoint: SessionCheckpoint): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { stateCheckpoint: serializeCheckpoint(checkpoint) },
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
    if (session.status === 'COMPLETED') throw new SessionAlreadyCompletedError(sessionId);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
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
          status: 'ESCALATED',
          escalatedAt: new Date(),
        },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }

  async incrementFailedAttempts(sessionId: string): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          failedAttempts: { increment: 1 },
        },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }

  async resetProgress(sessionId: string): Promise<Session> {
    try {
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          stateCheckpoint: {
            currentState: 'AWAITING_START',
            currentStepIndex: 0,
            questionCount: 0,
            lastQuestionTime: null,
            skippedActivities: [],
            failedAttempts: 0,
          },
          status: 'IDLE',
          completedAt: null,
          escalatedAt: null,
          failedAttempts: 0,
          outOfScope: false,
          safetyFlag: null,
        },
      });
      return mapSessionToDomain(updated);
    } catch (error) {
      handlePrismaError(error, SessionNotFoundError, sessionId);
    }
  }
}
