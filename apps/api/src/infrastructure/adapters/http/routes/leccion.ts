import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case';
import { StartLessonInputSchema, InteractLessonInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createLeccionRouter(orchestrateUseCase: OrchestrateLessonUseCase): Router {
  const router = Router();

  router.post(
    '/start',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const appRequest = request as AppRequest;
        const validated = StartLessonInputSchema.parse(appRequest.body);

        const result = await orchestrateUseCase.start(validated.lessonId, validated.studentId);

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
        const validated = InteractLessonInputSchema.parse(appRequest.body);

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
