import { randomUUID } from 'node:crypto';

import type { RecipeRepository } from '@/domain/ports/recipe-repository.js';
import { RecipeNotFoundError } from '@/domain/ports/recipe-repository.js';
import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { ActiveSessionExistsError } from '@/domain/ports/session-repository.js';

export class StartRecipeUseCase {
  constructor(
    private recipeRepo: RecipeRepository,
    private sessionRepo: SessionRepository,
  ) {}

  async execute(recipeId: string, studentId: string): Promise<{ sessionId: string }> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);
    if (existing && existing.status === 'ACTIVE') {
      throw new ActiveSessionExistsError(studentId, recipeId);
    }

    const sessionId = randomUUID();
    await this.sessionRepo.create({
      id: sessionId,
      studentId,
      recipeId,
      status: 'IDLE',
      stateCheckpoint: {
        currentState: 'ACTIVE_CLASS',
        currentStepIndex: 0,
      },
    });

    return { sessionId };
  }
}
