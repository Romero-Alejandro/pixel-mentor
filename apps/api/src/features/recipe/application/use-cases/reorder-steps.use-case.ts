import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  StepNotFoundError,
} from '@/shared/errors/domain-errors.js';
import type { RecipeStep } from '../../domain/entities/recipe.entity.js';

export class ReorderStepsUseCase {
  constructor(private recipeRepository: RecipeRepository) {}

  async execute(recipeId: string, stepIds: string[], userId: string): Promise<void> {
    const recipe = await this.recipeRepository.findById(recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(recipeId);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(recipeId, userId);
    }

    const steps = await this.recipeRepository.findStepsByRecipeId(recipeId);
    const stepIdSet = new Set(steps.map((s) => s.id));

    for (const id of stepIds) {
      if (!stepIdSet.has(id)) {
        throw new StepNotFoundError(id);
      }
    }

    for (let i = 0; i < stepIds.length; i++) {
      await this.recipeRepository.updateStep(stepIds[i], { order: i } as Partial<RecipeStep>);
    }
  }
}
