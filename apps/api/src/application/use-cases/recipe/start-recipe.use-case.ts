import { randomUUID } from 'node:crypto';

import type { RecipeRepository } from '@/domain/ports/recipe-repository.js';
import { RecipeNotFoundError } from '@/domain/ports/recipe-repository.js';
import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { isTerminalStatus } from '@/domain/entities/session.js';

export class StartRecipeUseCase {
  constructor(
    private recipeRepo: RecipeRepository,
    private sessionRepo: SessionRepository,
  ) {}

  async execute(recipeId: string, studentId: string): Promise<{ sessionId: string; resumed: boolean }> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);
    
    // If existing session is in non-terminal status, resume it
    if (existing && !isTerminalStatus(existing.status)) {
      return { sessionId: existing.id, resumed: true };
    }

    // Create new session (either no existing session or existing session is terminal)
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

    return { sessionId, resumed: false };
  }
}
