import { prisma } from '../client';
import type { UserProgress } from '@/domain/entities/user-progress';
import type { ProgressRepository } from '@/domain/ports/progress-repository';

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

  private mapProgress(raw: any): UserProgress {
    return {
      id: raw.id,
      userId: raw.userId,
      recipeId: raw.recipeId,
      atomId: raw.atomId,
      status: raw.status,
      score: raw.score,
      attempts: raw.attempts,
      lastAttemptAt: raw.lastAttemptAt,
      updatedAt: raw.updatedAt,
    };
  }
}
