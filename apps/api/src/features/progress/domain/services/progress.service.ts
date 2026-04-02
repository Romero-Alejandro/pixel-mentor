import type { ProgressRepository } from '../ports/progress.repository.port.js';
import type { UserProgress } from '../entities/user-progress.entity.js';

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
