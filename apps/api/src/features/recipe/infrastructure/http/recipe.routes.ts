import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';
import { ActivityResponseSchema, type ActivityResponse } from '@pixel-mentor/shared/activities';

import {
  checkDedup,
  markActive,
  markCompleted,
  markFailed,
} from '@/features/recipe/infrastructure/http/interaction-dedup-cache.js';
import {
  isMockRecipeId,
  putMockRecipe,
  MOCK_RECIPE_ID_PREFIX,
} from '@/shared/testing/mock-recipe.store.js';
import { createLogger } from '@/shared/logger/logger.js';
import { config } from '@/shared/config/index.js';
import type { AuthRequest } from '@/features/auth/infrastructure/http/auth.middleware';
import { InteractRecipeInputSchema, QuestionAnswerInputSchema } from '@/shared/dto';
// Re-export use cases from original location for backward compatibility
import type { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case';
import type { QuestionAnsweringUseCase } from '@/features/recipe/application/use-cases/question-answering.use-case';
import {
  llmGovernanceMiddleware,
  recordLLMUsage,
} from '@/shared/http/llm-governance.middleware.js';
import {
  SessionError,
  getUserErrorMessage,
  getErrorCode,
} from '@/features/recipe/domain/errors/session.errors';

// SSE heartbeat interval: 15 seconds (keeps connection alive through proxies)
const SSE_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Validates the Fase 1 `activityResponse` payload for the stream route
 * (which reads the body manually instead of through the interact schema).
 * Returns undefined for missing/invalid payloads — the grader then falls
 * back to text-based grading.
 */
function gradeRoutesReadActivityResponse(raw: unknown): ActivityResponse | undefined {
  if (raw === undefined || raw === null) return undefined;
  const parsed = ActivityResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

// Create a local logger for route handlers
const recipeRouterLogger = createLogger(undefined, { name: 'recipe-router', level: 'error' });

/**
 * Detects errors carrying statusCode 403 (e.g. cross-user session access
 * rejected by the orchestration use cases).
 */
function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 403
  );
}

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

  // Mock endpoint for E2E testing
  router.post('/mock/recipe', async (request: Request, response: Response): Promise<void> => {
    try {
      recipeRouterLogger.info('[MOCK] Received request to save mock recipe');
      const recipe = request.body;
      recipeRouterLogger.info('[MOCK] Recipe data: %o', recipe);
      if (
        !recipe ||
        typeof recipe.id !== 'string' ||
        recipe.id.length === 0 ||
        !isMockRecipeId(recipe.id)
      ) {
        recipeRouterLogger.error('[MOCK] Invalid recipe data or missing ID');
        response
          .status(400)
          .json({ error: `Invalid recipe data: id must start with '${MOCK_RECIPE_ID_PREFIX}'` });
        return;
      }
      putMockRecipe(recipe);
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
        const result = await orchestrateUseCase.interact(
          sessionId,
          studentInput,
          appRequest.user?.id,
          validated.optionId,
          validated.activityResponse,
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
        if (isForbiddenError(error)) {
          response.status(403).json({
            error: 'No tienes permisos para interactuar con esta sesión',
            code: 'FORBIDDEN',
          });
          return;
        }
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
      const optionId =
        typeof appRequest.body?.optionId === 'string' ? appRequest.body.optionId : undefined;
      // Fase 1 formats (mcq_multi, true_false, ordering): structured payload
      // (zod-validated on the interact schema when streaming validation runs;
      // duck-typed here for the manual body reads this route performs).
      const activityResponse = gradeRoutesReadActivityResponse(appRequest.body?.activityResponse);

      if (!sessionId || !studentInput) {
        response.status(400).json({ error: 'sessionId and studentInput required in request body' });
        return;
      }

      if (!config.ENABLE_STREAMING) {
        response.status(403).json({ error: 'Streaming disabled' });
        return;
      }

      // ── Deduplication check ──────────────────────────────────────────────
      const interactionId =
        typeof appRequest.body?.interactionId === 'string'
          ? appRequest.body.interactionId
          : undefined;

      if (interactionId) {
        const dedup = checkDedup(interactionId);

        if (dedup.status === 'active') {
          // Another request with same ID is already streaming
          recipeRouterLogger.info(
            { interactionId, sessionId, activeSince: dedup.activeSince },
            '[POST /interact/stream] Duplicate active request, returning 409',
          );
          response.status(409).json({
            error: 'Interaction already in progress',
            interactionId,
            retryAfter: 1,
          });
          return;
        }

        if (dedup.status === 'completed' && dedup.cachedResponse) {
          // Return cached response as SSE events
          recipeRouterLogger.info(
            { interactionId, sessionId },
            '[POST /interact/stream] Duplicate completed request, returning cached response',
          );
          response.setHeader('Content-Type', 'text/event-stream');
          response.setHeader('Cache-Control', 'no-cache');
          response.setHeader('Connection', 'keep-alive');
          response.flushHeaders();
          response.write(dedup.cachedResponse);
          response.end();
          return;
        }
      }

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.flushHeaders();

      // Start heartbeat to prevent proxy/load-balancer idle timeouts
      const heartbeat = setInterval(() => {
        if (!response.writableEnded) {
          response.write(':heartbeat\n\n');
        }
      }, SSE_HEARTBEAT_INTERVAL_MS);

      // Clear heartbeat if client disconnects before stream completes
      response.on('close', () => {
        clearInterval(heartbeat);
      });

      // Mark as active for deduplication
      if (interactionId) markActive(interactionId);

      let errorSent = false;
      let fullResponse = '';
      let sseChunks = ''; // Collect all SSE output for caching

      const originalWrite = response.write.bind(response);
      const capturingWrite: typeof response.write = (
        chunk: string | Buffer,
        ...args: unknown[]
      ) => {
        if (typeof chunk === 'string') sseChunks += chunk;
        return originalWrite(chunk, ...(args as []));
      };
      // Monkey-patch write to capture SSE output for dedup cache
      response.write = capturingWrite as typeof response.write;

      try {
        const stream = orchestrateUseCase.interactStream(
          sessionId,
          studentInput,
          appRequest.user?.id,
          optionId,
          activityResponse,
        );

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
                correctOptionId: chunk.correctOptionId,
                correctAnswer: chunk.correctAnswer,
                activityFormat: chunk.activityFormat,
                score: chunk.score,
                autoAdvance: chunk.autoAdvance,
                xpEarned: chunk.xpEarned,
                accuracy: chunk.accuracy,
              })}\n\n`,
            );

            // Record LLM usage for streaming
            recordLLMUsage(appRequest, `stream:${sessionId}`, fullResponse, true);

            // Cache completed response for dedup
            if (interactionId) markCompleted(interactionId, sseChunks);
            break;
          }
        }
      } catch (error) {
        if (isForbiddenError(error)) {
          if (!response.writableEnded) {
            response.write(
              `event: error\ndata: ${JSON.stringify({
                message: 'No tienes permisos para interactuar con esta sesión',
                code: 'FORBIDDEN',
                statusCode: 403,
              })}\n\n`,
            );
          }
          if (interactionId) markFailed(interactionId);
          return;
        }
        const userMessage = getUserErrorMessage(error);
        const errorCode = getErrorCode(error);
        const statusCode = error instanceof SessionError ? error.statusCode : 500;
        const metadata = error instanceof SessionError ? error.metadata : undefined;

        recipeRouterLogger.error(
          { err: error, errorCode, statusCode, sessionId, metadata },
          '[POST /interact/stream] Error',
        );

        if (!errorSent) {
          response.write(
            `event: error\ndata: ${JSON.stringify({
              message: userMessage,
              code: errorCode,
              statusCode,
              ...(metadata ? { metadata } : {}),
            })}\n\n`,
          );
          errorSent = true;
        }

        // Record failed LLM usage for streaming
        recordLLMUsage(appRequest, `stream:${sessionId}`, fullResponse, false, userMessage);

        // Remove from dedup cache on failure
        if (interactionId) markFailed(interactionId);
      } finally {
        clearInterval(heartbeat);
        if (!response.writableEnded) {
          response.end();
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
          userId: appRequest.user?.id,
          userRole: appRequest.user?.role,
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
        if (isForbiddenError(error)) {
          response.status(403).json({
            error: 'No tienes permisos para consultar esta receta',
            code: 'FORBIDDEN',
          });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
