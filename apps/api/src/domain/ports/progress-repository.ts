import type { UserProgress } from '../entities/user-progress';

export interface ProgressRepository {
  findByUserId(userId: string): Promise<UserProgress[]>;
  findByUserIdAndRecipeId(userId: string, recipeId: string): Promise<UserProgress | null>;
  findByUserIdAndAtomId(userId: string, atomId: string): Promise<UserProgress | null>;
  create(progress: Omit<UserProgress, 'updatedAt'>): Promise<UserProgress>;
  update(id: string, data: Partial<UserProgress>): Promise<UserProgress>;
  upsert(
    progress: Partial<UserProgress> & { userId: string; recipeId?: string; atomId?: string },
  ): Promise<UserProgress>;
  findByScore(score: number): Promise<UserProgress[]>;
  findByAttempts(attempts: number): Promise<UserProgress[]>;
  findByLastAttemptAt(lastAttemptAt: Date): Promise<UserProgress[]>;
}
