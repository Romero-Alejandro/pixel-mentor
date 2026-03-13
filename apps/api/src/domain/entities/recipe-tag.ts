export interface RecipeTag {
  readonly recipeId: string;
  readonly tagId: string;
}

export function createRecipeTag(parameters: { recipeId: string; tagId: string }): RecipeTag {
  return { recipeId: parameters.recipeId, tagId: parameters.tagId };
}
