import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';
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

/**
 * Partial update payload for a recipe step.
 *
 * Unlike `Partial<RecipeStep>`, the JSON columns distinguish "absent" (keep
 * current value) from `null` (clear the column) — mirroring Prisma's own
 * update semantics — so callers can unset step content explicitly.
 */
export type RecipeStepUpdateInput = {
  -readonly [K in keyof Omit<RecipeStep, 'activityData' | 'question'>]?: Omit<
    RecipeStep,
    'activityData' | 'question'
  >[K];
} & {
  activityData?: Record<string, unknown> | null;
  question?: Record<string, unknown> | null;
};

export interface RecipeRepository {
  findById(id: string): Promise<Recipe | null>;
  findByIdWithSteps(id: string): Promise<Recipe | null>;
  findAll(): Promise<Recipe[]>;
  findPublished(): Promise<Recipe[]>;
  findByUserId(userId: string): Promise<Recipe[]>;
  findByUserIdAndPublished(userId: string, published: boolean): Promise<Recipe[]>;
  create(recipe: RecipeCreateInput): Promise<Recipe>;
  update(id: string, data: RecipeUpdateInput): Promise<Recipe>;
  delete(id: string): Promise<void>;
  findStepsByRecipeId(recipeId: string): Promise<RecipeStep[]>;
  findStepsWithContent(recipeId: string): Promise<RecipeStepWithContent[]>;
  createStep(step: Omit<RecipeStep, 'createdAt'>): Promise<RecipeStep>;
  updateStep(stepId: string, step: RecipeStepUpdateInput): Promise<RecipeStep>;
  deleteStep(stepId: string): Promise<void>;
  findStepById(stepId: string): Promise<RecipeStep | null>;
  /**
   * Atomically persists the desired step order for a recipe.
   *
   * `stepIds` lists the steps that take the leading positions, in the given
   * order (0-based); unlisted steps follow in their previous relative order.
   * The whole operation (membership validation + constraint-safe two-phase
   * swap under @@unique([recipeId, order])) runs in a single transaction:
   * it either fully applies or leaves the previous order untouched.
   *
   * @throws StepNotFoundError if a listed step does not belong to the recipe.
   */
  reorderSteps(recipeId: string, stepIds: string[]): Promise<void>;
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
