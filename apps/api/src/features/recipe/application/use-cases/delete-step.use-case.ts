import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import { RecipeNotFoundError, RecipeOwnershipError, StepNotFoundError } from '@/shared/errors/domain-errors.js';

export class DeleteStepUseCase {
  constructor(private recipeRepository: RecipeRepository) {}

  async execute(stepId: string, userId: string): Promise<void> {
    const step = await this.recipeRepository.findStepById(stepId);
    if (!step) {
      throw new StepNotFoundError(stepId);
    }

    const recipe = await this.recipeRepository.findById(step.recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(step.recipeId);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(step.recipeId, userId);
    }

    await this.recipeRepository.deleteStep(stepId);
  }
}