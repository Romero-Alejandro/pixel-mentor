import type {
  UserProgress,
  ProgressStatus,
} from '@/features/progress/domain/entities/user-progress.entity.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port.js';
import { prisma } from '@/database/client.js';

/** Row shape returned by the generated UserProgress delegate. */
type UserProgressRow =
  ReturnType<typeof prisma.userProgress.findUniqueOrThrow> extends Promise<infer R> ? R : never;

const PROGRESS_STATUSES: readonly ProgressStatus[] = [
  'LOCKED',
  'UNLOCKED',
  'IN_PROGRESS',
  'MASTERED',
  'NEEDS_REMEDIATION',
  'FAILED',
];

function isProgressStatus(value: string): value is ProgressStatus {
  return (PROGRESS_STATUSES as readonly string[]).includes(value);
}

/**
 * Converts an unknown status into a domain-valid one.
 * The domain union and the Prisma enum share the same members, so valid
 * values map 1:1; unknown values throw instead of silently persisting.
 */
function assertProgressStatus(value: string): ProgressStatus {
  if (isProgressStatus(value)) return value;
  throw new Error(`Unknown progress status: ${value}`);
}

export class PrismaProgressRepository implements ProgressRepository {
  async findByUserId(userId: string): Promise<UserProgress[]> {
    const raw = await prisma.userProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return raw.map(this.mapProgress);
  }

  async findByUserIdAndRecipeId(userId: string, recipeId: string): Promise<UserProgress | null> {
    const raw = await prisma.userProgress.findFirst({
      where: { userId, recipeId },
    });
    return raw ? this.mapProgress(raw) : null;
  }

  async findByUserIdAndAtomId(userId: string, atomId: string): Promise<UserProgress | null> {
    const raw = await prisma.userProgress.findFirst({
      where: { userId, atomId },
    });
    return raw ? this.mapProgress(raw) : null;
  }

  async create(progress: Omit<UserProgress, 'updatedAt'>): Promise<UserProgress> {
    const raw = await prisma.userProgress.create({
      data: {
        id: progress.id,
        userId: progress.userId,
        recipeId: progress.recipeId,
        atomId: progress.atomId,
        status: progress.status,
        score: progress.score,
        attempts: progress.attempts,
        lastAttemptAt: progress.lastAttemptAt,
      },
    });
    return this.mapProgress(raw);
  }

  async update(id: string, data: Partial<UserProgress>): Promise<UserProgress> {
    const raw = await prisma.userProgress.update({
      where: { id },
      data: {
        status: data.status,
        score: data.score,
        attempts: data.attempts,
        lastAttemptAt: data.lastAttemptAt,
      },
    });
    return this.mapProgress(raw);
  }

  async upsert(
    progress: Partial<UserProgress> & { userId: string; recipeId?: string; atomId?: string },
  ): Promise<UserProgress> {
    const existing = await prisma.userProgress.findFirst({
      where: { userId: progress.userId, recipeId: progress.recipeId, atomId: progress.atomId },
    });

    if (existing) {
      return this.update(existing.id, progress);
    }

    return this.create({
      id: crypto.randomUUID(),
      userId: progress.userId,
      recipeId: progress.recipeId,
      atomId: progress.atomId,
      status: progress.status ?? 'LOCKED',
      score: progress.score,
      attempts: progress.attempts ?? 0,
      lastAttemptAt: progress.lastAttemptAt,
    });
  }

  async findByScore(score: number): Promise<UserProgress[]> {
    const raw = await prisma.userProgress.findMany({
      where: { score },
      orderBy: { updatedAt: 'desc' },
    });
    return raw.map(this.mapProgress);
  }

  async findByAttempts(attempts: number): Promise<UserProgress[]> {
    const raw = await prisma.userProgress.findMany({
      where: { attempts },
      orderBy: { updatedAt: 'desc' },
    });
    return raw.map(this.mapProgress);
  }

  async findByLastAttemptAt(lastAttemptAt: Date): Promise<UserProgress[]> {
    const raw = await prisma.userProgress.findMany({
      where: { lastAttemptAt },
      orderBy: { updatedAt: 'desc' },
    });
    return raw.map(this.mapProgress);
  }

  async countByUserIdAndStatus(userId: string, statuses: string[]): Promise<number> {
    return prisma.userProgress.count({
      where: { userId, status: { in: statuses.map(assertProgressStatus) } },
    });
  }

  async findMasteredByUser(userId: string): Promise<UserProgress[]> {
    const raw = await prisma.userProgress.findMany({
      where: { userId, status: 'MASTERED', recipeId: { not: null } },
      select: {
        recipeId: true,
        id: true,
        userId: true,
        atomId: true,
        status: true,
        score: true,
        attempts: true,
        lastAttemptAt: true,
        updatedAt: true,
      },
    });
    return raw.map(this.mapProgress);
  }

  async findOrCreateByUserAndRecipe(
    userId: string,
    recipeId: string,
    status: string,
  ): Promise<UserProgress> {
    const existing = await prisma.userProgress.findFirst({
      where: { userId, recipeId },
    });

    const validatedStatus = assertProgressStatus(status);
    if (existing) {
      if (existing.status !== status) {
        const raw = await prisma.userProgress.update({
          where: { id: existing.id },
          data: { status: validatedStatus, attempts: { increment: 1 }, lastAttemptAt: new Date() },
        });
        return this.mapProgress(raw);
      }
      return this.mapProgress(existing);
    }

    const raw = await prisma.userProgress.create({
      data: { userId, recipeId, status: validatedStatus, attempts: 1, lastAttemptAt: new Date() },
    });
    return this.mapProgress(raw);
  }

  private mapProgress(raw: UserProgressRow): UserProgress {
    return {
      id: raw.id,
      userId: raw.userId,
      recipeId: raw.recipeId ?? undefined,
      atomId: raw.atomId ?? undefined,
      status: assertProgressStatus(raw.status),
      score: raw.score ?? undefined,
      attempts: raw.attempts,
      lastAttemptAt: raw.lastAttemptAt ?? undefined,
      updatedAt: raw.updatedAt,
    };
  }
}
