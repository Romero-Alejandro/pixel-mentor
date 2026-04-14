import { randomUUID } from 'node:crypto';

import type { RecipeRepository } from '@/features/recipe/domain/ports/recipe.repository.port';
import { RecipeNotFoundError } from '@/features/recipe/domain/ports/recipe.repository.port';
import type { SessionRepository } from '@/features/session/domain/ports/session.repository.port';
import {
  isTerminalStatus,
  startSession,
  createSession,
} from '@/features/session/domain/entities/session.entity';

export class StartRecipeUseCase {
  constructor(
    private recipeRepo: RecipeRepository,
    private sessionRepo: SessionRepository,
  ) {}

  async execute(
    recipeId: string,
    studentId: string,
  ): Promise<{ sessionId: string; resumed: boolean }> {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);

    // If existing session is in non-terminal status, resume it
    if (existing && !isTerminalStatus(existing.status)) {
      return { sessionId: existing.id, resumed: true };
    }

    // Create new session (either no existing session or existing session is terminal)
    const sessionId = randomUUID();
    let newSession = createSession({
      id: sessionId,
      studentId,
      recipeId,
      stateCheckpoint: {
        currentState: 'AWAITING_START',
        currentStepIndex: 0,
        questionCount: 0,
        lastQuestionTime: null,
        skippedActivities: [],
        failedAttempts: 0,
      },
    });
    newSession = startSession(newSession); // Transition: IDLE -> ACTIVE
    await this.sessionRepo.create(newSession);

    return { sessionId, resumed: false };
  }
}
