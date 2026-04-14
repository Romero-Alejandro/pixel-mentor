import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';

interface ValueObject<T> {
  value?: T;
  minutes?: T;
}

function isValueObject(obj: unknown): obj is ValueObject<unknown> {
  return obj !== null && typeof obj === 'object' && ('value' in obj || 'minutes' in obj);
}

function extractPrimitive(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return null;
  const target = (obj as Record<string, unknown>)[key];

  if (isValueObject(target)) {
    return target.minutes ?? target.value;
  }
  return target ?? null;
}

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
    activity: (step as any).activity ?? null,
    question: (step as any).question ?? null,
    stepType: step.stepType ?? null,
  };
}

export function mapRecipeToOutput(recipe: Recipe): Record<string, unknown> {
  const canonicalId = extractPrimitive(recipe, 'canonicalId');
  const duration = extractPrimitive(recipe, 'expectedDurationMinutes');
  const version = extractPrimitive(recipe, 'version');

  return {
    id: recipe.id,
    canonicalId: canonicalId ? String(canonicalId) : '',
    title: recipe.title,
    description: recipe.description ?? null,
    expectedDurationMinutes: duration !== null ? Number(duration) : null,
    version: version ? String(version) : '1.0.0',
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

export function mapRecipesToOutput(recipes: Recipe[]): Record<string, unknown>[] {
  return recipes.map(mapRecipeToOutput);
}
