import type { Recipe, RecipeStep } from '../entities/recipe.entity';

import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';
import type { Activity } from '@/features/activity/domain/entities/activity.entity';

export interface RecipeWithConcepts extends Recipe {
  readonly concepts?: readonly Concept[];
}

export interface RecipeStepWithContent extends RecipeStep {
  readonly concept?: Concept | null | undefined;
  readonly activity?: Activity | null | undefined;
}

export interface RecipeCreateInput {
  id: string;
  canonicalId: string;
  title: string;
  description?: string;
  expectedDurationMinutes?: number;
  version: string;
  published: boolean;
  moduleId?: string;
  authorId: string;
}

export interface RecipeUpdateInput {
  canonicalId?: string;
  title?: string;
  description?: string;
  expectedDurationMinutes?: number;
  version?: string;
  published?: boolean;
  moduleId?: string;
}

export interface RecipeRepository {
  findById(id: string): Promise<Recipe | null>;
  findByIdWithSteps(id: string): Promise<Recipe | null>;
  findAll(): Promise<Recipe[]>;
  findPublished(): Promise<Recipe[]>;
  create(recipe: RecipeCreateInput): Promise<Recipe>;
  update(id: string, data: RecipeUpdateInput): Promise<Recipe>;
  delete(id: string): Promise<void>;
  findStepsByRecipeId(recipeId: string): Promise<RecipeStep[]>;
  findStepsWithContent(recipeId: string): Promise<RecipeStepWithContent[]>;
  createStep(step: Omit<RecipeStep, 'createdAt'>): Promise<RecipeStep>;
  updateStep(stepId: string, step: Partial<RecipeStep>): Promise<RecipeStep>;
  deleteStep(stepId: string): Promise<void>;
  findStepById(stepId: string): Promise<RecipeStep | null>;
}

export class RecipeNotFoundError extends Error {
  readonly code = 'RECIPE_NOT_FOUND' as const;
  readonly recipeId: string;
  constructor(recipeId: string) {
    super(`Recipe with ID ${recipeId} not found`);
    this.name = 'RecipeNotFoundError';
    this.recipeId = recipeId;
  }
}

export class RecipeInactiveError extends Error {
  readonly code = 'RECIPE_INACTIVE' as const;
  readonly recipeId: string;
  constructor(recipeId: string) {
    super(`Recipe with ID ${recipeId} is not published`);
    this.name = 'RecipeInactiveError';
    this.recipeId = recipeId;
  }
}

export async function getRecipeOrError(
  repository: RecipeRepository,
  id: string,
  requiresPublished: boolean = true,
): Promise<Recipe> {
  const recipe = await repository.findById(id);
  if (!recipe) throw new RecipeNotFoundError(id);
  if (requiresPublished && !recipe.published) throw new RecipeInactiveError(id);
  return recipe;
}
