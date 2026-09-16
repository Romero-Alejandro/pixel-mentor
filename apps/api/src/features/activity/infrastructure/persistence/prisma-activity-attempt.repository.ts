import type { Prisma } from '@/database/client.js';
import { prisma } from '@/database/client.js';
import { toPrismaJsonOrUndefined } from '@/shared/utils/prisma-json.js';
import type { ActivityAttempt } from '@/features/activity/domain/entities/activity-attempt.entity.js';
import type {
  ActivityAttemptByAtom,
  ActivityAttemptRepository,
} from '@/features/activity/domain/ports/activity-attempt.repository.port.js';

/**
 * Row shape returned by the generated ActivityAttempt delegate, including the
 * optional relation payloads the repository may request via `include`.
 */
interface ActivityAttemptRow {
  id: string;
  userId: string;
  atomId: string;
  atomOptionId: string | null;
  attemptNo: number;
  response: Prisma.JsonValue | null;
  correct: boolean | null;
  elapsedMs: number | null;
  hintUsed: number;
  meta: Prisma.JsonValue | null;
  createdAt: Date;
  atom?: {
    id: string;
    type: string;
    content: Prisma.JsonValue | null;
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  } | null;
  selectedOption?: { id: string; text: string; isCorrect: boolean } | null;
}

export class PrismaActivityAttemptRepository implements ActivityAttemptRepository {
  async findByUserIdAndAtomId(userId: string, atomId: string): Promise<ActivityAttempt[]> {
    const raw = await prisma.activityAttempt.findMany({
      where: { userId, atomId },
      orderBy: { createdAt: 'desc' },
    });
    return raw.map(this.mapAttempt);
  }

  async findByUserIdAndAtomIds(
    userId: string,
    atomIds: readonly string[],
  ): Promise<ActivityAttemptByAtom[]> {
    if (atomIds.length === 0) return [];

    // Projection: only the fields needed for lesson accuracy calculation, so the
    // batch stays small even for many attempts.
    const raw = await prisma.activityAttempt.findMany({
      where: { userId, atomId: { in: [...atomIds] } },
      select: { atomId: true, attemptNo: true, correct: true },
    });
    return raw.map((row) => ({
      atomId: row.atomId,
      attemptNo: row.attemptNo,
      ...(row.correct !== null ? { correct: row.correct } : {}),
    }));
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

  async getMaxAttemptNoByUserIdAndAtomId(userId: string, atomId: string): Promise<number> {
    // Aggregation instead of findFirst: no row payload, served by the
    // @@index([userId, atomId, createdAt]) index in O(log n).
    const result = await prisma.activityAttempt.aggregate({
      where: { userId, atomId },
      _max: { attemptNo: true },
    });
    return result._max.attemptNo ?? 0;
  }

  async create(attempt: Omit<ActivityAttempt, 'createdAt'>): Promise<ActivityAttempt> {
    const raw = await prisma.activityAttempt.create({
      data: {
        userId: attempt.userId,
        atomId: attempt.atomId,
        atomOptionId: attempt.atomOptionId,
        attemptNo: attempt.attemptNo,
        response: toPrismaJsonOrUndefined(attempt.response, 'attempt.response'),
        correct: attempt.correct,
        elapsedMs: attempt.elapsedMs,
        hintUsed: attempt.hintUsed,
        meta: toPrismaJsonOrUndefined(attempt.meta, 'attempt.meta'),
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
        response: toPrismaJsonOrUndefined(data.response, 'attempt.response'),
        correct: data.correct,
        elapsedMs: data.elapsedMs,
        hintUsed: data.hintUsed,
        meta: toPrismaJsonOrUndefined(data.meta, 'attempt.meta'),
      },
    });
    return this.mapAttempt(raw);
  }

  async countCorrectFirstAttempts(userId: string): Promise<number> {
    return prisma.activityAttempt.count({
      where: { userId, correct: true, attemptNo: 1 },
    });
  }

  private mapAttempt(raw: ActivityAttemptRow): ActivityAttempt {
    const base = {
      id: raw.id,
      userId: raw.userId,
      atomId: raw.atomId,
      atomOptionId: raw.atomOptionId ?? undefined,
      attemptNo: raw.attemptNo,
      response: raw.response ?? undefined,
      correct: raw.correct ?? undefined,
      elapsedMs: raw.elapsedMs ?? undefined,
      hintUsed: raw.hintUsed,
      meta: raw.meta ?? undefined,
      createdAt: raw.createdAt,
    };

    const attempt: ActivityAttempt = {
      ...base,
      ...(raw.atom && {
        atom: {
          id: raw.atom.id,
          type: raw.atom.type,
          content: raw.atom.content ?? undefined,
          options: raw.atom.options?.map((opt) => ({
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
