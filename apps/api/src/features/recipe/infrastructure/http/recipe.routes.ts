import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import { createLogger } from '@/shared/logger/logger.js';
import { config } from '@/shared/config/index.js';
import type { AuthRequest } from '@/features/auth/infrastructure/http/auth.middleware';
import {
  StartRecipeInputSchema,
  InteractRecipeInputSchema,
  QuestionAnswerInputSchema,
} from '@/shared/dto';
// Re-export use cases from original location for backward compatibility
import type { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case';
import type { QuestionAnsweringUseCase } from '@/features/recipe/application/use-cases/question-answering.use-case';
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

// In-memory mock storage for testing
const mockRecipes: Record<string, any> = {};
globalThis.__mockRecipes = mockRecipes;

export function createRecipeRouter(
  orchestrateUseCase: OrchestrateRecipeUseCase,
  questionAnsweringUseCase?: QuestionAnsweringUseCase,
): Router {
  const router = Router();

  // Mock endpoint for E2E testing
  router.post('/mock/recipe', async (request: Request, response: Response): Promise<void> => {
    try {
      recipeRouterLogger.info('[MOCK] Received request to save mock recipe');
      const recipe = request.body;
      recipeRouterLogger.info('[MOCK] Recipe data: %o', recipe);
      if (!recipe || !recipe.id) {
        recipeRouterLogger.error('[MOCK] Invalid recipe data or missing ID');
        response.status(400).json({ error: 'Invalid recipe data or missing ID' });
        return;
      }
      mockRecipes[recipe.id] = recipe;
      recipeRouterLogger.info(`[MOCK] Recipe saved successfully: ${recipe.id}`);
      response
        .status(201)
        .json({ success: true, message: 'Mock recipe saved', recipeId: recipe.id });
    } catch (error) {
      recipeRouterLogger.error('[MOCK] Failed to save recipe: %s', error);
      response.status(500).json({ error: 'Failed to save mock recipe', details: String(error) });
    }
  });

  const llmGovernance = llmGovernanceMiddleware();

  // POST /interact - Interact with a recipe session
  router.post(
    '/interact',
    llmGovernance,
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      const appRequest = request as AppRequest;
      const validated = InteractRecipeInputSchema.parse(appRequest.body);

      const sessionId = validated.sessionId;
      const studentInput = validated.studentInput;

      if (!sessionId || !studentInput) {
        response.status(400).json({ error: 'sessionId and studentInput required' });
        return;
      }

      try {
        const result = await orchestrateUseCase.interact(sessionId, studentInput);

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
