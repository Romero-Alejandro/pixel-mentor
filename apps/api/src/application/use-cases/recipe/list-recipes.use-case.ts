import type { RecipeRepository } from '@/domain/ports/recipe-repository';

export class ListRecipesUseCase {
  constructor(private recipeRepo: RecipeRepository) {}

  async execute(activeOnly: boolean = true) {
    if (activeOnly) {
      return await this.recipeRepo.findPublished();
    }
    return await this.recipeRepo.findAll();
  }
}
