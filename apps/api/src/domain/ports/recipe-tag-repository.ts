import type { RecipeTag } from '../entities/recipe-tag.js';

export interface RecipeTagRepository {
  findByRecipeId(recipeId: string): Promise<RecipeTag[]>;
  findByTagId(tagId: string): Promise<RecipeTag[]>;
  create(recipeTag: Omit<RecipeTag, 'id'>): Promise<RecipeTag>;
  delete(recipeId: string, tagId: string): Promise<void>;
}
