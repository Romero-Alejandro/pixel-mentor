import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { GetRecipeUseCase } from '@/features/recipe/application/use-cases/get-recipe.use-case';
import type { ListRecipesUseCase } from '@/features/recipe/application/use-cases/list-recipes.use-case';
import type { CreateRecipeUseCase } from '@/features/recipe/application/use-cases/create-recipe.use-case';
import type { UpdateRecipeUseCase } from '@/features/recipe/application/use-cases/update-recipe.use-case';
import type { DeleteRecipeUseCase } from '@/features/recipe/application/use-cases/delete-recipe.use-case';
import type { AddStepUseCase } from '@/features/recipe/application/use-cases/add-step.use-case';
import type { UpdateStepUseCase } from '@/features/recipe/application/use-cases/update-step.use-case';
import type { DeleteStepUseCase } from '@/features/recipe/application/use-cases/delete-step.use-case';
import type { ReorderStepsUseCase } from '@/features/recipe/application/use-cases/reorder-steps.use-case';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeInUseError,
  RecipeValidationError,
  StepNotFoundError,
} from '@/shared/errors/domain-errors.js';
import {
  GetRecipeInputSchema,
  ListRecipesInputSchema,
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  type UpdateRecipeInput,
  RecipeStepInputSchema,
  type RecipeStepInput,
  ReorderStepsInputSchema,
  normalizeStepData,
} from '@/shared/dto/index';
import type { AppRequest } from '@/shared/types/express.d.js';
import type {
  Recipe,
  RecipeStep,
  StepType,
} from '@/features/recipe/domain/entities/recipe.entity.js';

/** JSON-serializable step as returned by the recipes API. */
type RecipeStepResponse = RecipeStep & { stepType: StepType };

/** JSON-serializable recipe as returned by the recipes API. */
interface RecipeApiResponse {
  id: string;
  canonicalId: string;
  title: string;
  description?: string;
  expectedDurationMinutes?: number;
  version: string;
  published: boolean;
  moduleId?: string;
  createdAt?: string;
  updatedAt?: string;
  steps: RecipeStepResponse[];
}

/** Unwrap the CanonicalId VO (or a raw string, defensively) to its string form. */
function canonicalIdToString(value: Recipe['canonicalId']): string {
  return typeof value === 'string' ? value : value.value;
}

/** Unwrap the ExpectedDuration VO to plain minutes. */
function durationToMinutes(value: Recipe['expectedDurationMinutes']): number | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? value : value.minutes;
}

/** Serialize the SemanticVersion VO (or a raw value, defensively). */
function versionToString(value: Recipe['version']): string {
  return typeof value === 'object' ? value.toString() : String(value);
}

/** Map domain steps to the API shape, defaulting stepType like the UI expects. */
function mapRecipeSteps(steps: readonly RecipeStep[]): RecipeStepResponse[] {
  return steps.map((step) => ({
    ...step,
    stepType: step.stepType ?? 'content',
  }));
}

/** Transform a domain Recipe into its JSON-serializable API response. */
function toRecipeResponse(recipe: Recipe): RecipeApiResponse {
  return {
    id: recipe.id,
    canonicalId: canonicalIdToString(recipe.canonicalId),
    title: recipe.title,
    description: recipe.description,
    expectedDurationMinutes: durationToMinutes(recipe.expectedDurationMinutes),
    version: versionToString(recipe.version),
    published: recipe.published,
    moduleId: recipe.moduleId,
    createdAt: recipe.createdAt?.toISOString(),
    updatedAt: recipe.updatedAt?.toISOString(),
    steps: mapRecipeSteps(recipe.steps ?? []),
  };
}

export interface RecipesRouterDependencies {
  getRecipeUseCase: GetRecipeUseCase;
  listRecipesUseCase: ListRecipesUseCase;
  createRecipeUseCase: CreateRecipeUseCase;
  updateRecipeUseCase: UpdateRecipeUseCase;
  deleteRecipeUseCase: DeleteRecipeUseCase;
  addStepUseCase: AddStepUseCase;
  updateStepUseCase: UpdateStepUseCase;
  deleteStepUseCase: DeleteStepUseCase;
  reorderStepsUseCase: ReorderStepsUseCase;
}

export function createRecipesRouter(deps: RecipesRouterDependencies): Router {
  const {
    getRecipeUseCase,
    listRecipesUseCase,
    createRecipeUseCase,
    updateRecipeUseCase,
    deleteRecipeUseCase,
    addStepUseCase,
    updateStepUseCase,
    deleteStepUseCase,
    reorderStepsUseCase,
  } = deps;
  const router = Router();

  // GET /:id - Get recipe by ID
  router.get(
    '/:id',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = GetRecipeInputSchema.parse({ recipeId: request.params.id as string });

        const recipe = await getRecipeUseCase.execute(validated.recipeId);

        // Only published recipes are visible to everyone. Drafts are restricted
        // to their author (teacher) and administrators.
        const requesterId = request.user?.id;
        const requesterRole = request.user?.role;
        if (!recipe.published && recipe.authorId !== requesterId && requesterRole !== 'ADMIN') {
          response.status(403).json({
            error: 'No tienes permisos para acceder a esta receta',
            code: 'FORBIDDEN',
          });
          return;
        }

        const plainRecipe = toRecipeResponse(recipe);

        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.json(plainRecipe);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // GET / - List all recipes
  router.get(
    '/',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const rawIsMy = request.query.isMy;
        const rawPublishedOnly = request.query.publishedOnly;

        const query = {
          isMy: rawIsMy !== undefined ? rawIsMy === 'true' : undefined,
          publishedOnly: rawPublishedOnly !== undefined ? rawPublishedOnly === 'true' : undefined,
        };

        const validated = ListRecipesInputSchema.parse(query);

        const userId = request.user?.id;
        const recipes = await listRecipesUseCase.execute({
          isMy: validated.isMy,
          publishedOnly: validated.publishedOnly,
          userId,
        });

        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.json(recipes);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  // POST / - Create a new recipe
  router.post(
    '/',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const validated = CreateRecipeInputSchema.parse(request.body);

        const normalizedSteps = (validated.steps ?? []).map((step) => normalizeStepData(step));

        const recipe = await createRecipeUseCase.execute(
          {
            title: validated.title,
            description: validated.description,
            expectedDurationMinutes: validated.expectedDurationMinutes ?? undefined,
            moduleId: validated.moduleId ?? undefined,
            published: validated.published,
            steps: normalizedSteps,
          },
          userId,
        );

        const plainRecipe = toRecipeResponse(recipe);

        response.status(201).json(plainRecipe);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        if (error instanceof RecipeValidationError) {
          response.status(400).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // PATCH /:id - Update a recipe
  router.patch(
    '/:id',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id as string;
        request.logger?.debug({ body: request.body }, '[PATCH recipe] Request body');

        let validated: UpdateRecipeInput;
        try {
          validated = UpdateRecipeInputSchema.parse(request.body);
          request.logger?.debug({ validated }, '[PATCH recipe] Validated');
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            request.logger?.error(
              { zodErrors: validationError.issues, receivedBody: request.body },
              '[PATCH recipe] Zod validation FAILED',
            );
          }
          throw validationError;
        }

        request.logger?.debug({ validated }, '[PATCH recipe] Validated data');

        const recipe = await updateRecipeUseCase.execute(
          recipeId,
          {
            title: validated.title,
            description: validated.description,
            expectedDurationMinutes: validated.expectedDurationMinutes,
            moduleId: validated.moduleId,
            published: validated.published,
          },
          userId,
        );

        const plainRecipe = toRecipeResponse(recipe);

        response.json(plainRecipe);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeOwnershipError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeValidationError) {
          response.status(400).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // DELETE /:id - Delete a recipe
  router.delete(
    '/:id',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id as string;

        await deleteRecipeUseCase.execute(recipeId, userId);

        response.status(204).send();
      } catch (error) {
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeOwnershipError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeInUseError) {
          response.status(409).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // POST /:id/steps - Add a step to a recipe
  router.post(
    '/:id/steps',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id as string;
        request.logger?.debug({ recipeId }, '[addStep] Request received');

        let validated: RecipeStepInput;
        try {
          // Normalizar datos del formato UI al formato Zod
          const normalized = normalizeStepData(request.body);

          // Validar con Zod schema
          validated = RecipeStepInputSchema.parse(normalized);
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            const errorMessages = validationError.issues
              .map((issue) => {
                const path = issue.path.join('.');
                return `${path ? path + ': ' : ''}${issue.message}`;
              })
              .join('; ');

            request.logger?.error(
              { zodErrors: validationError.issues },
              '[addStep] Zod validation failed',
            );
            response.status(400).json({
              error: 'Error de validación',
              message: errorMessages,
              details: validationError.issues,
            });
            return;
          }
          throw validationError;
        }

        const step = await addStepUseCase.execute(
          recipeId,
          {
            atomId: validated.atomId ?? undefined,
            order: validated.order,
            conceptId: validated.conceptId ?? undefined,
            activityId: validated.activityId ?? undefined,
            stepType: validated.stepType,
            script: validated.script,
            activity: validated.activity,
            question: validated.question,
          },
          userId,
        );
        response.status(201).json(step);
      } catch (error) {
        request.logger?.error({ err: error }, '[addStep] Failed');
        if (error instanceof z.ZodError) {
          const errorMessages = error.issues
            .map((issue) => {
              const path = issue.path.join('.');
              return `${path ? path + ': ' : ''}${issue.message}`;
            })
            .join('; ');

          request.logger?.error({ zodErrors: error.issues }, '[addStep] Zod validation failed');
          response.status(400).json({
            error: 'Error de validación',
            message: errorMessages,
            details: error.issues,
          });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeOwnershipError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // PATCH /:id/steps/reorder - Reorder steps (MUST be BEFORE /:id/steps/:stepId)
  router.patch(
    '/:id/steps/reorder',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id as string;
        const validated = ReorderStepsInputSchema.parse(request.body);

        request.logger.info({ recipeId, stepIds: validated.stepIds }, '[reorderSteps]');

        await reorderStepsUseCase.execute(recipeId, validated.stepIds, userId);

        response.status(204).send();
      } catch (error) {
        request.logger.error({ err: error }, '[reorderSteps] Full error');
        if (error instanceof z.ZodError) {
          response.status(400).json({
            error: 'Validation error',
            message: error.message,
            details: error.issues,
          });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof StepNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeOwnershipError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // PATCH /:id/steps/:stepId - Update a step
  router.patch(
    '/:id/steps/:stepId',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const stepId = request.params.stepId as string;
        const validated = RecipeStepInputSchema.parse(request.body);

        const step = await updateStepUseCase.execute(
          stepId,
          {
            atomId: validated.atomId ?? undefined,
            order: validated.order,
            conceptId: validated.conceptId ?? undefined,
            activityId: validated.activityId ?? undefined,
            stepType: validated.stepType,
            script: validated.script,
            activity: validated.activity,
            question: validated.question,
          },
          userId,
        );

        response.json(step);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessages = error.issues
            .map((issue) => {
              const path = issue.path.join('.');
              return `${path ? path + ': ' : ''}${issue.message}`;
            })
            .join('; ');

          response.status(400).json({
            error: 'Error de validación',
            message: errorMessages,
            details: error.issues,
          });
          return;
        }
        if (error instanceof StepNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeOwnershipError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  // DELETE /:id/steps/:stepId - Delete a step
  router.delete(
    '/:id/steps/:stepId',
    // @ts-expect-error - Express 5 compatibility
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const stepId = request.params.stepId as string;

        await deleteStepUseCase.execute(stepId, userId);

        response.status(204).send();
      } catch (error) {
        if (error instanceof StepNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof RecipeOwnershipError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
