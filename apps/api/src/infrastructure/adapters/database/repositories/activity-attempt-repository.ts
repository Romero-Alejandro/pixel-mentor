import { prisma } from '../client';

import type { ActivityAttempt } from '@/domain/entities/activity-attempt';
import type { ActivityAttemptRepository } from '@/domain/ports/activity-attempt-repository';

export class PrismaActivityAttemptRepository implements ActivityAttemptRepository {
  async findByUserIdAndAtomId(userId: string, atomId: string): Promise<ActivityAttempt[]> {
    const raw = await prisma.activityAttempt.findMany({
      where: { userId, atomId },
      orderBy: { createdAt: 'desc' },
    });
    return raw.map(this.mapAttempt);
  }

  async findLatestByUserIdAndAtomId(
    userId: string,
    atomId: string,
  ): Promise<ActivityAttempt | null> {
    const raw = await prisma.activityAttempt.findFirst({
      where: { userId, atomId },
      orderBy: { createdAt: 'desc' },
      include: {
        atom: {
          select: {
            id: true,
            type: true,
            content: true,
            options: {
              select: {
                id: true,
                text: true,
                isCorrect: true,
              },
            },
          },
        },
        selectedOption: {
          select: {
            id: true,
            text: true,
            isCorrect: true,
          },
        },
      },
    });
    return raw ? this.mapAttempt(raw) : null;
  }

  async create(attempt: Omit<ActivityAttempt, 'createdAt'>): Promise<ActivityAttempt> {
    const raw = await prisma.activityAttempt.create({
      data: {
        userId: attempt.userId,
        atomId: attempt.atomId,
        atomOptionId: attempt.atomOptionId,
        attemptNo: attempt.attemptNo,
        response: attempt.response,
        correct: attempt.correct,
        elapsedMs: attempt.elapsedMs,
        hintUsed: attempt.hintUsed,
        meta: attempt.meta,
      },
    });
    return this.mapAttempt(raw);
  }

  async update(id: string, data: Partial<ActivityAttempt>): Promise<ActivityAttempt> {
    const raw = await prisma.activityAttempt.update({
      where: { id },
      data: {
        atomOptionId: data.atomOptionId,
        attemptNo: data.attemptNo,
        response: data.response,
        correct: data.correct,
        elapsedMs: data.elapsedMs,
        hintUsed: data.hintUsed,
        meta: data.meta,
      },
    });
    return this.mapAttempt(raw);
  }

  private mapAttempt(raw: any): ActivityAttempt {
    const base = {
      id: raw.id,
      userId: raw.userId,
      atomId: raw.atomId,
      atomOptionId: raw.atomOptionId,
      attemptNo: raw.attemptNo,
      response: raw.response,
      correct: raw.correct,
      elapsedMs: raw.elapsedMs,
      hintUsed: raw.hintUsed,
      meta: raw.meta,
      createdAt: raw.createdAt,
    };

    const attempt: ActivityAttempt = {
      ...base,
      ...(raw.atom && {
        atom: {
          id: raw.atom.id,
          type: raw.atom.type,
          content: raw.atom.content,
          options: raw.atom.options?.map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        },
      }),
      ...(raw.selectedOption && {
        atomOption: {
          id: raw.selectedOption.id,
          text: raw.selectedOption.text,
          isCorrect: raw.selectedOption.isCorrect,
        },
      }),
    };

    return attempt;
  }
}
