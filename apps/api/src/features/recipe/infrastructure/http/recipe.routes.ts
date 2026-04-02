import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import pino from 'pino';
import { createLogger } from '@/shared/logger/logger.js';

import type { AuthRequest } from '@/features/auth/infrastructure/http/auth.middleware';
import {
  StartRecipeInputSchema,
  InteractRecipeInputSchema,
  QuestionAnswerInputSchema,
} from '@/shared/dto';
// Re-export use cases from original location for backward compatibility
import { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case';
import { QuestionAnsweringUseCase } from '@/features/recipe/application/use-cases/question-answering.use-case';

// Create a local logger for route handlers
const recipeRouterLogger = createLogger(undefined, { name: 'recipe-router', level: 'error' });

export interface AppRequest extends AuthRequest {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createRecipeRouter(
  orchestrateUseCase: OrchestrateRecipeUseCase,
  questionAnsweringUseCase?: QuestionAnsweringUseCase,
): Router {
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
      const appRequest = request as AppRequest;
      try {
        const validated = InteractRecipeInputSchema.parse(appRequest.body);

        const result = await orchestrateUseCase.interact(
          validated.sessionId,
          validated.studentInput,
        );

        response.json(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        recipeRouterLogger.error({ err: errorMessage }, '[POST /interact] Error');
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.get(
    '/interact/stream',
    async (request: Request, response: Response, _next: NextFunction): Promise<void> => {
      const sessionId =
        typeof request.query.sessionId === 'string' ? request.query.sessionId : undefined;
      const studentInput =
        typeof request.query.studentInput === 'string' ? request.query.studentInput : undefined;

      if (!sessionId || !studentInput) {
        response.status(400).json({ error: 'sessionId and studentInput required' });
        return;
      }

      if (!process.env.ENABLE_STREAMING) {
        response.status(403).json({ error: 'Streaming disabled' });
        return;
      }

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.flushHeaders();

      let errorSent = false;

      try {
        const stream = orchestrateUseCase.interactStream(sessionId, studentInput);

        for await (const chunk of stream) {
          if (chunk.type === 'chunk') {
            response.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
          } else if (chunk.type === 'end') {
            response.write(
              `event: end\ndata: ${JSON.stringify({
                reason: chunk.reason,
                pedagogicalState: chunk.pedagogicalState,
                sessionCompleted: chunk.sessionCompleted,
                lessonProgress: chunk.lessonProgress,
              })}\n\n`,
            );
            break;
          }
        }
      } catch (error) {
        if (!errorSent) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          const code = (error as { code?: string }).code ?? 'INTERNAL_ERROR';
          response.write(`event: error\ndata: ${JSON.stringify({ message, code })}\n\n`);
          errorSent = true;
        }
      } finally {
        response.end();
      }
    },
  );

  router.post(
    '/question',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const appRequest = request as AppRequest;
        const validated = QuestionAnswerInputSchema.parse(appRequest.body);

        if (!questionAnsweringUseCase) {
          response.status(501).json({ error: 'Question answering not available' });
          return;
        }

        const result = await questionAnsweringUseCase.execute({
          recipeId: validated.recipeId,
          question: validated.question,
        });

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
