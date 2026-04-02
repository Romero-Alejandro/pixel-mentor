import type { UserProgress } from '../entities/user-progress.entity.js';

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
  countByUserIdAndStatus(userId: string, statuses: string[]): Promise<number>;
  findMasteredByUser(userId: string): Promise<UserProgress[]>;
  findOrCreateByUserAndRecipe(
    userId: string,
    recipeId: string,
    status: string,
  ): Promise<UserProgress>;
}
