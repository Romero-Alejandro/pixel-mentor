import type { RecipeRepository } from '@/features/recipe/domain/ports/recipe.repository.port.js';
import { RecipeNotFoundError, RecipeOwnershipError } from '@/shared/errors/domain-errors.js';

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

    // Membership validation + constraint-safe reorder run atomically in the
    // repository — see PrismaRecipeRepository.reorderSteps.
    await this.recipeRepository.reorderSteps(recipeId, stepIds);
  }
}
