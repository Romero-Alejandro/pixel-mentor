import type { RecipeRepository } from '../../domain/ports/recipe.repository.port';

export interface ListRecipesOptions {
  isMy?: boolean;
  publishedOnly?: boolean;
  userId?: string;
}

export class ListRecipesUseCase {
  constructor(private recipeRepo: RecipeRepository) {}

  async execute(options: ListRecipesOptions = {}): Promise<any> {
    const { isMy, publishedOnly, userId } = options;

    if (!userId) {
      return await this.recipeRepo.findAll();
    }

    if (isMy && publishedOnly !== undefined) {
      return await this.recipeRepo.findByUserIdAndPublished(userId, publishedOnly);
    }

    if (isMy) {
      return await this.recipeRepo.findByUserId(userId);
    }

    if (publishedOnly !== undefined) {
      if (publishedOnly) {
        return await this.recipeRepo.findPublished();
      }
      return await this.recipeRepo.findAll();
    }

    return await this.recipeRepo.findAll();
  }
}
