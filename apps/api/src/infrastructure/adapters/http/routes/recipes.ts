import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { GetRecipeUseCase } from '@/application/use-cases/recipe/get-recipe.use-case';
import type { ListRecipesUseCase } from '@/application/use-cases/recipe/list-recipes.use-case';
import type { RecipeService } from '@/application/services/recipe.service.js';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeInUseError,
  RecipeValidationError,
  StepNotFoundError,
} from '@/application/services/recipe.service.js';
import {
  GetRecipeInputSchema,
  ListRecipesInputSchema,
  CreateRecipeInputSchema,
  UpdateRecipeInputSchema,
  RecipeStepInputSchema,
  ReorderStepsInputSchema,
} from '@/application/dto';
import type { AppRequest } from '@/types/express.js';

export interface RecipesRouterDependencies {
  getRecipeUseCase: GetRecipeUseCase;
  listRecipesUseCase: ListRecipesUseCase;
  recipeService: RecipeService;
}

export function createRecipesRouter(deps: RecipesRouterDependencies): Router {
  const { getRecipeUseCase, listRecipesUseCase, recipeService } = deps;
  const router = Router();

  // GET /:id - Get recipe by ID
  router.get(
    '/:id',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = GetRecipeInputSchema.parse({ recipeId: request.params.id });

        const recipe = await getRecipeUseCase.execute(validated.recipeId);

        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.json(recipe);
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
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const query: { activeOnly?: boolean } = {};
        const rawActiveOnly = request.query.activeOnly;
        if (rawActiveOnly !== undefined) {
          const val = Array.isArray(rawActiveOnly) ? rawActiveOnly[0] : rawActiveOnly;
          query.activeOnly = val === 'true';
        }

        const validated = ListRecipesInputSchema.parse(query);

        const recipes = await listRecipesUseCase.execute(validated.activeOnly);

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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const validated = CreateRecipeInputSchema.parse(request.body);

        const recipe = await recipeService.createRecipe(
          {
            title: validated.title,
            description: validated.description,
            expectedDurationMinutes: validated.expectedDurationMinutes,
            moduleId: validated.moduleId,
            published: validated.published,
            steps: validated.steps,
          },
          userId,
        );

        response.status(201).json(recipe);
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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id;
        const validated = UpdateRecipeInputSchema.parse(request.body);

        const isAdmin = request.user?.role === 'ADMIN';

        const recipe = await recipeService.updateRecipe(
          recipeId,
          {
            title: validated.title,
            description: validated.description,
            expectedDurationMinutes: validated.expectedDurationMinutes,
            moduleId: validated.moduleId,
            published: validated.published,
          },
          userId,
          isAdmin,
        );

        response.json(recipe);
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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id;
        const isAdmin = request.user?.role === 'ADMIN';

        await recipeService.deleteRecipe(recipeId, userId, isAdmin);

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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id;
        const validated = RecipeStepInputSchema.parse(request.body);

        const step = await recipeService.addStep(
          recipeId,
          {
            atomId: validated.atomId,
            order: validated.order,
            conceptId: validated.conceptId,
            activityId: validated.activityId,
            stepType: validated.stepType,
            script: validated.script as any,
            activity: validated.activity as any,
            question: validated.question as any,
          },
          userId,
        );

        response.status(201).json(step);
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Format error messages for better UX
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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id;
        const validated = ReorderStepsInputSchema.parse(request.body);

        console.log('[reorderSteps] recipeId:', recipeId, 'stepIds:', validated.stepIds);

        await recipeService.reorderSteps(recipeId, validated.stepIds, userId);

        response.status(204).send();
      } catch (error) {
        console.error('[reorderSteps] Full error:', error);
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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const stepId = request.params.stepId;
        const validated = RecipeStepInputSchema.parse(request.body);

        const step = await recipeService.updateStep(
          stepId,
          {
            atomId: validated.atomId,
            order: validated.order,
            conceptId: validated.conceptId,
            activityId: validated.activityId,
            stepType: validated.stepType,
            script: validated.script as any,
            activity: validated.activity as any,
            question: validated.question as any,
          },
          userId,
        );

        response.json(step);
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Format error messages for better UX
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
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const stepId = request.params.stepId;

        await recipeService.deleteStep(stepId, userId);

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

  // PATCH /:id/steps/reorder - Reorder steps
  router.patch(
    '/:id/steps/reorder',
    async (request: AppRequest, response: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const recipeId = request.params.id;
        const validated = ReorderStepsInputSchema.parse(request.body);

        await recipeService.reorderSteps(recipeId, validated.stepIds, userId);

        response.status(204).send();
      } catch (error) {
        console.error('[reorderSteps] Full error:', error);
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

  return router;
}
