import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import pino from 'pino';
import { createLogger } from '@/shared/logger/logger.js';
import { config } from '@/shared/config/index.js';

import type { AuthRequest } from '@/features/auth/infrastructure/http/auth.middleware';
import {
  StartRecipeInputSchema,
  InteractRecipeInputSchema,
  QuestionAnswerInputSchema,
} from '@/shared/dto';
// Re-export use cases from original location for backward compatibility
import { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case';
import { QuestionAnsweringUseCase } from '@/features/recipe/application/use-cases/question-answering.use-case';
import {
  llmGovernanceMiddleware,
  recordLLMUsage,
} from '@/shared/http/llm-governance.middleware.js';

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

  // LLM governance middleware for routes that call LLMs
  const llmGovernance = llmGovernanceMiddleware();

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
    llmGovernance,
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      const appRequest = request as AppRequest;
      let sessionId = 'unknown';
      try {
        const validated = InteractRecipeInputSchema.parse(appRequest.body);
        sessionId = validated.sessionId;

        const result = await orchestrateUseCase.interact(
          validated.sessionId,
          validated.studentInput,
        );

        // Record LLM usage for governance tracking
        recordLLMUsage(
          appRequest,
          `interact:${sessionId}`,
          JSON.stringify(result).slice(0, 500),
          true,
        );

        response.json(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        recipeRouterLogger.error({ err: errorMessage }, '[POST /interact] Error');

        // Record failed LLM usage
        recordLLMUsage(appRequest, `interact:${sessionId}`, '', false, errorMessage);

        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/interact/stream',
    llmGovernance,
    async (request: Request, response: Response, _next: NextFunction): Promise<void> => {
      const appRequest = request as AppRequest;
      const sessionId =
        typeof appRequest.body?.sessionId === 'string' ? appRequest.body.sessionId : undefined;
      const studentInput =
        typeof appRequest.body?.studentInput === 'string'
          ? appRequest.body.studentInput
          : undefined;

      if (!sessionId || !studentInput) {
        response.status(400).json({ error: 'sessionId and studentInput required in request body' });
        return;
      }

      if (!config.ENABLE_STREAMING) {
        response.status(403).json({ error: 'Streaming disabled' });
        return;
      }

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.flushHeaders();

      let errorSent = false;
      let fullResponse = '';

      try {
        const stream = orchestrateUseCase.interactStream(sessionId, studentInput);

        for await (const chunk of stream) {
          if (chunk.type === 'chunk') {
            fullResponse += chunk.text ?? '';
            response.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
          } else if (chunk.type === 'end') {
            if (config.NODE_ENV === 'development') {
            }
            response.write(
              `event: end\ndata: ${JSON.stringify({
                reason: chunk.reason,
                pedagogicalState: chunk.pedagogicalState,
                sessionCompleted: chunk.sessionCompleted,
                staticContent: chunk.staticContent,
                lessonProgress: chunk.lessonProgress,
                feedback: chunk.feedback,
                isCorrect: chunk.isCorrect,
                autoAdvance: chunk.autoAdvance,
                xpEarned: chunk.xpEarned,
                accuracy: chunk.accuracy,
              })}\n\n`,
            );

            // Record LLM usage for streaming
            recordLLMUsage(appRequest, `stream:${sessionId}`, fullResponse, true);
            break;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (config.NODE_ENV === 'development') {
        }
        if (!errorSent) {
          const code = (error as { code?: string }).code ?? 'INTERNAL_ERROR';
          response.write(
            `event: error\ndata: ${JSON.stringify({ message: errorMessage, code })}\n\n`,
          );
          errorSent = true;
        }

        // Record failed LLM usage for streaming
        recordLLMUsage(appRequest, `stream:${sessionId}`, fullResponse, false, errorMessage);
      } finally {
        response.end();
        if (config.NODE_ENV === 'development') {
        }
      }
    },
  );

  router.post(
    '/question',
    llmGovernance,
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

        // Record LLM usage
        recordLLMUsage(
          appRequest,
          `question:${validated.recipeId}`,
          JSON.stringify(result).slice(0, 500),
          true,
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
