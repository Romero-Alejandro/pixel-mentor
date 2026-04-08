import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import { RecipeNotFoundError, RecipeOwnershipError } from '@/shared/errors/domain-errors.js';

export class DeleteRecipeUseCase {
  constructor(private recipeRepository: RecipeRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError(id);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(id, userId);
    }

    await this.recipeRepository.update(id, { published: false });
  }
}
