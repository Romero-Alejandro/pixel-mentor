import { prisma, Prisma } from '@/database/client.js';
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
  score: number | null;
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

    // Projection: only the fields needed for accuracy/adaptivity calculations,
    // so the batch stays small even for many attempts.
    const raw = await prisma.activityAttempt.findMany({
      where: { userId, atomId: { in: [...atomIds] } },
      select: {
        atomId: true,
        attemptNo: true,
        correct: true,
        score: true,
        elapsedMs: true,
        hintUsed: true,
        meta: true,
      },
    });
    return raw.map((row) => {
      const meta = (row.meta ?? null) as { format?: unknown } | null;
      const format = typeof meta?.format === 'string' ? meta.format : undefined;
      return {
        atomId: row.atomId,
        attemptNo: row.attemptNo,
        ...(row.correct !== null ? { correct: row.correct } : {}),
        ...(row.score !== null ? { score: row.score } : {}),
        ...(row.elapsedMs !== null ? { elapsedMs: row.elapsedMs } : {}),
        hintUsed: row.hintUsed,
        ...(format !== undefined ? { format } : {}),
      };
    });
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
        score: attempt.score,
        elapsedMs: attempt.elapsedMs,
        hintUsed: attempt.hintUsed,
        meta: toPrismaJsonOrUndefined(attempt.meta, 'attempt.meta'),
      },
    });
    return this.mapAttempt(raw);
  }

  async recordAttempt(
    attempt: Omit<ActivityAttempt, 'createdAt' | 'attemptNo'>,
  ): Promise<ActivityAttempt> {
    // attemptNo is computed then inserted under the
    // @@unique([userId, atomId, attemptNo]) constraint. A concurrent writer for
    // the same (user, atom) loses the race with P2002 and retries with the
    // freshly recomputed number, so attemptNo stays monotonic without duplicates.
    const MAX_RETRIES = 3;
    for (let retry = 0; ; retry++) {
      const attemptNo =
        (await this.getMaxAttemptNoByUserIdAndAtomId(attempt.userId, attempt.atomId)) + 1;
      try {
        return await this.create({ ...attempt, attemptNo });
      } catch (error) {
        const isAttemptNoRace =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isAttemptNoRace || retry >= MAX_RETRIES - 1) throw error;
      }
    }
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

  async countHintFreeCorrectFirstAttemptAtoms(userId: string): Promise<number> {
    // First attempt per atom = attemptNo 1 (monotonic numbering guarantees it).
    // DISTINCT atoms so re-attempted atoms are not double counted.
    const rows = await prisma.activityAttempt.findMany({
      where: { userId, attemptNo: 1, correct: true, hintUsed: 0 },
      select: { atomId: true },
      distinct: ['atomId'],
    });
    return rows.length;
  }

  async countAtomsWithHighPartialCredit(userId: string, minScore: number): Promise<number> {
    // A best-effort "last attempt per atom" read: we can't express per-group
    // max() ranking in Prisma without raw SQL, so we take the highest attemptNo
    // rows per atom via a groupBy pre-pass (small: one row per atom) and then
    // filter those rows by score.
    const groups = await prisma.activityAttempt.groupBy({
      by: ['atomId'],
      where: { userId },
      _max: { attemptNo: true },
    });
    if (groups.length === 0) return 0;

    let count = 0;
    for (const group of groups) {
      const last = await prisma.activityAttempt.findFirst({
        where: { userId, atomId: group.atomId, attemptNo: group._max.attemptNo ?? 1 },
        select: { score: true },
      });
      if (last?.score !== undefined && last.score !== null && last.score >= minScore) {
        count++;
      }
    }
    return count;
  }

  private mapAttempt(raw: ActivityAttemptRow): ActivityAttempt {
    const metaFormat =
      raw.meta !== null &&
      typeof raw.meta === 'object' &&
      'format' in raw.meta &&
      typeof (raw.meta as { format: unknown }).format === 'string'
        ? (raw.meta as { format: string }).format
        : undefined;
    const base = {
      id: raw.id,
      userId: raw.userId,
      atomId: raw.atomId,
      atomOptionId: raw.atomOptionId ?? undefined,
      attemptNo: raw.attemptNo,
      response: raw.response ?? undefined,
      correct: raw.correct ?? undefined,
      score: raw.score ?? undefined,
      elapsedMs: raw.elapsedMs ?? undefined,
      hintUsed: raw.hintUsed,
      meta: raw.meta ?? undefined,
      createdAt: raw.createdAt,
    };

    const attempt: ActivityAttempt = {
      ...base,
      ...(metaFormat !== undefined ? { format: metaFormat } : {}),
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
