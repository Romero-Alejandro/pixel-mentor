import type { ProgressRepository } from '../ports/progress-repository.js';
import type { UserProgress } from '../entities/user-progress.js';

export class ProgressService {
  constructor(private progressRepo: ProgressRepository) {}

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return this.progressRepo.findByUserId(userId);
  }

  async upsertProgress(
    progress: Partial<UserProgress> & { userId: string; recipeId?: string; atomId?: string },
  ): Promise<UserProgress> {
    return this.progressRepo.upsert(progress);
  }
}
