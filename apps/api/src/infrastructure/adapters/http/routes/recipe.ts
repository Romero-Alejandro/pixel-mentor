import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { AuthRequest } from '../middleware/auth.js';

import type { OrchestrateRecipeUseCase } from '@/application/use-cases';
import type { QuestionAnsweringUseCase } from '@/application/use-cases/question/question-answering.use-case.js';
import {
  StartRecipeInputSchema,
  InteractRecipeInputSchema,
  QuestionAnswerInputSchema,
} from '@/application/dto';

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

  router.get(
    '/interact/stream',
    async (request: Request, response: Response, _next: NextFunction): Promise<void> => {
      // 1. Extract query params
      const sessionId =
        typeof request.query.sessionId === 'string' ? request.query.sessionId : undefined;
      const studentInput =
        typeof request.query.studentInput === 'string' ? request.query.studentInput : undefined;

      // 2. Validate required params
      if (!sessionId || !studentInput) {
        response.status(400).json({ error: 'sessionId and studentInput required' });
        return;
      }

      // 3. Feature flag check
      if (!process.env.ENABLE_STREAMING) {
        response.status(403).json({ error: 'Streaming disabled' });
        return;
      }

      // 4. Set SSE headers
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.flushHeaders();

      let errorSent = false;

      try {
        // 7. Stream chunks from use case
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
        // 10. On error, send error event if not already sent
        if (!errorSent) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          const code = (error as any).code ?? (error as any).statusCode ?? 'INTERNAL_ERROR';
          response.write(`event: error\ndata: ${JSON.stringify({ message, code })}\n\n`);
          errorSent = true;
        }
      } finally {
        // 9. & 11. End the response
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
