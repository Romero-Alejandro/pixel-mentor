import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { GetRecipeUseCase } from '@/application/use-cases/recipe/get-recipe.use-case';
import type { ListRecipesUseCase } from '@/application/use-cases/recipe/list-recipes.use-case';
import { GetRecipeInputSchema, ListRecipesInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createRecipesRouter(
  getRecipeUseCase: GetRecipeUseCase,
  listRecipesUseCase: ListRecipesUseCase,
): Router {
  const router = Router();

  router.get(
    '/:id',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = GetRecipeInputSchema.parse({ recipeId: request.params.id });

        const recipe = await getRecipeUseCase.execute(validated.recipeId);

        response.json(recipe);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

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

  return router;
}
