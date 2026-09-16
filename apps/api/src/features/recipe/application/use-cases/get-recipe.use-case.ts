import type { RecipeRepository } from '@/features/recipe/domain/ports/recipe.repository.port.js';
import {
  RecipeNotFoundError,
  RecipeInactiveError,
} from '@/features/recipe/domain/ports/recipe.repository.port.js';

export class GetRecipeUseCase {
  constructor(private recipeRepo: RecipeRepository) {}

  async execute(recipeId: string, requireActive: boolean = false) {
    const recipe = await this.recipeRepo.findByIdWithSteps(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);
    if (requireActive && !recipe.published) throw new RecipeInactiveError(recipeId);
    return recipe;
  }
}
