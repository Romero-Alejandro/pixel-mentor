import type { RecipeRepository } from '@/domain/ports/recipe-repository';
import { RecipeNotFoundError, RecipeInactiveError } from '@/domain/ports/recipe-repository';

export class GetRecipeUseCase {
  constructor(private recipeRepo: RecipeRepository) {}

  async execute(recipeId: string, requireActive: boolean = false) {
    const recipe = await this.recipeRepo.findByIdWithSteps(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);
    if (requireActive && !recipe.published) throw new RecipeInactiveError(recipeId);
    return recipe;
  }
}
