import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';

/**
 * In-memory store for E2E mock recipes.
 *
 * Recipes whose id starts with `MOCK_RECIPE_ID_PREFIX` are served from here
 * (seeded via POST /api/recipe/mock/recipe) instead of the database, so E2E
 * tests can exercise the lesson flow without seeding knowledge atoms.
 *
 * Module-scoped singleton: intentionally survives across route modules and
 * use cases that import it, replacing the former `globalThis.__mockRecipes`.
 */
export const MOCK_RECIPE_ID_PREFIX = 'test-recipe-';

const store = new Map<string, Recipe & { steps: RecipeStep[] }>();

export function isMockRecipeId(recipeId: string): boolean {
  return recipeId.startsWith(MOCK_RECIPE_ID_PREFIX);
}

export function putMockRecipe(recipe: Recipe & { steps: RecipeStep[] }): void {
  store.set(recipe.id, recipe);
}

export function getMockRecipe(recipeId: string): (Recipe & { steps: RecipeStep[] }) | undefined {
  return store.get(recipeId);
}

export function clearMockRecipes(): void {
  store.clear();
}
