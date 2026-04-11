/**
 * Recipe DTO mappers for API responses.
 *
 * Converts internal domain types (with Value Objects) to API response types (with primitives).
 * This ensures JSON serialization works correctly without exposing internal Value Object classes.
 */

import type { Recipe } from '@/features/recipe/domain/entities/recipe.entity.js';
import type { RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';

/**
 * Helper to safely extract primitive value from a Value Object
 * Value Objects have getters like .value, .minutes that return the underlying primitive
 */
function extractValue(obj: unknown, prop: string): unknown {
  if (obj === null || obj === undefined) {
    return null;
  }

  // Check if it's an object with a getter for the property
  if (typeof obj === 'object' && prop in obj) {
    const value = (obj as Record<string, unknown>)[prop];
    // If it's a Value Object with a getter, call it
    if (value && typeof value === 'object') {
      if ('value' in value) {
        return (value as { value: unknown }).value;
      }
      if ('minutes' in value) {
        return (value as { minutes: unknown }).minutes;
      }
    }
    return value;
  }

  return null;
}

/**
 * Convert RecipeStep to a plain object with primitives
 */
function mapRecipeStepToOutput(step: RecipeStep): Record<string, unknown> {
  return {
    id: step.id,
    recipeId: step.recipeId,
    atomId: step.atomId ?? null,
    order: step.order,
    condition: step.condition ?? null,
    onCondition: step.onCondition ?? null,
    createdAt: step.createdAt instanceof Date ? step.createdAt.toISOString() : step.createdAt,
    conceptId: step.conceptId ?? null,
    activityId: step.activityId ?? null,
    script: step.script ?? null,
    stepType: step.stepType ?? null,
  };
}

/**
 * Convert Recipe to API output format with primitive values
 * Handles Value Objects properly by extracting their underlying values
 */
export function mapRecipeToOutput(recipe: Recipe): Record<string, unknown> {
  // Extract values from Value Objects using the getters
  const canonicalId = extractValue(recipe, 'canonicalId') ?? '';
  const expectedDurationMinutes = extractValue(recipe, 'expectedDurationMinutes') ?? null;
  const version = extractValue(recipe, 'version') ?? '1.0.0';

  return {
    id: recipe.id,
    canonicalId: String(canonicalId),
    title: recipe.title,
    description: recipe.description ?? null,
    expectedDurationMinutes:
      expectedDurationMinutes !== null ? Number(expectedDurationMinutes) : null,
    version: String(version),
    published: recipe.published,
    moduleId: recipe.moduleId ?? null,
    authorId: recipe.authorId,
    createdAt: recipe.createdAt instanceof Date ? recipe.createdAt.toISOString() : recipe.createdAt,
    updatedAt: recipe.updatedAt instanceof Date ? recipe.updatedAt.toISOString() : recipe.updatedAt,
    steps: Array.isArray(recipe.steps) ? recipe.steps.map(mapRecipeStepToOutput) : [],
    concepts: [],
    tags: [],
    attachments: [],
    progressEntries: [],
  };
}

/**
 * Convert array of Recipes to API output format
 */
export function mapRecipesToOutput(recipes: Recipe[]): Record<string, unknown>[] {
  return recipes.map(mapRecipeToOutput);
}
