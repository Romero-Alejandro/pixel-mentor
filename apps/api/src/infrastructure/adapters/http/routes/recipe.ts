import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { AuthRequest } from '../middleware/auth.js';

import type { OrchestrateRecipeUseCase } from '@/application/use-cases';
import { StartRecipeInputSchema, InteractRecipeInputSchema } from '@/application/dto';

export interface AppRequest extends AuthRequest {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createRecipeRouter(orchestrateUseCase: OrchestrateRecipeUseCase): Router {
  const router = Router();

  router.post(
    '/start',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const appRequest = request as AppRequest;
        const validated = StartRecipeInputSchema.parse(appRequest.body);
        const userId = appRequest.user?.id;

        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const result = await orchestrateUseCase.start(validated.recipeId, userId);

        response.status(201).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/interact',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const appRequest = request as AppRequest;
        const validated = InteractRecipeInputSchema.parse(appRequest.body);

        const result = await orchestrateUseCase.interact(
          validated.sessionId,
          validated.studentInput,
        );

        response.json(result);
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
