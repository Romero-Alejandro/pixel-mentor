import { randomUUID } from 'node:crypto';

import type { ProgressRepository } from '@/domain/ports/progress-repository.js';
import type { UserProgress, ProgressStatus } from '@/domain/entities/user-progress.js';

export class TrackProgressUseCase {
  constructor(private progressRepo: ProgressRepository) {}

  async execute(
    userId: string,
    recipeId?: string,
    atomId?: string,
    status?: ProgressStatus,
  ): Promise<{ progressId: string }> {
    const progressId = randomUUID();

    const existing = recipeId
      ? await this.progressRepo.findByUserIdAndRecipeId(userId, recipeId)
      : null;

    if (existing) {
      if (status) {
        await this.progressRepo.update(existing.id, { status });
      }
      return { progressId: existing.id };
    } else {
      const progress: Omit<UserProgress, 'updatedAt'> = {
        id: progressId,
        userId,
        recipeId,
        atomId,
        status: status ?? 'LOCKED',
        attempts: 0,
      };
      await this.progressRepo.create(progress);
      return { progressId };
    }
  }
}
