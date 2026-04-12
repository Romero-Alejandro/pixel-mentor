/**
 * Recipe AI Routes
 *
 * REST API endpoints for AI-powered recipe/unidad generation.
 * All routes require TEACHER role authentication.
 */

import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/shared/types/express.d.js';
import type {
  RecipeAIService,
  GenerateRecipeDraftInput,
} from '@/features/recipe/application/services/recipe-ai.service.js';

// Inline schema to avoid module resolution issues
const GenerateRecipeDraftInputSchema = z.object({
  topic: z.string().min(1).max(500),
  targetAgeMin: z.number().min(3).max(18),
  targetAgeMax: z.number().min(3).max(18),
  objectives: z.array(z.string()).min(1).max(10),
});

type SSEEventType = 'step' | 'progress' | 'error' | 'complete';

/**
 * Send SSE event to client
 */
function sendSSEEvent(res: Response, event: SSEEventType, data: unknown): void {
  if (!res.writableEnded) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export interface RecipeAIRouterDependencies {
  recipeAIService: RecipeAIService;
}

/**
 * Create router for AI generation at /api/ai
 */
export function createRecipeAIRouter(deps: RecipeAIRouterDependencies): Router {
  const { recipeAIService } = deps;
  const router = Router();

  /**
   * POST /api/ai/generate-recipe - Generate AI draft for a recipe/unidad
   * Auth: TEACHER role required
   */
  router.post('/generate-recipe', (async (
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Check TEACHER role
      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      // Parse and validate request body
      const validatedData = GenerateRecipeDraftInputSchema.parse(req.body);

      const input: GenerateRecipeDraftInput = {
        topic: validatedData.topic,
        learningObjectives: validatedData.objectives,
        targetAgeMin: validatedData.targetAgeMin,
        targetAgeMax: validatedData.targetAgeMax,
      };

      const draft = await recipeAIService.generateRecipeDraft(input);

      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }) as any);

  /**
   * GET /api/ai/generate-recipe/stream - SSE endpoint for streaming AI recipe generation
   * Auth: TEACHER role required
   * Events: step, progress, error, complete
   */
  router.get('/generate-recipe/stream', (async (
    req: AppRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Check TEACHER role
      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      // Get query params
      const topic = req.query.topic as string;
      const targetAgeMin = Number(req.query.targetAgeMin) || 6;
      const targetAgeMax = Number(req.query.targetAgeMax) || 8;
      const objectives = (req.query.objectives as string)?.split(',').filter(Boolean) || ['Learn'];

      if (!topic || !topic.trim()) {
        res.status(400).json({ error: 'Topic is required' });
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if behind proxy
      res.flushHeaders();

      req.logger?.info(
        { topic, targetAgeMin, targetAgeMax },
        '[AI Recipe SSE] Starting generation',
      );

      const input: GenerateRecipeDraftInput = {
        topic,
        learningObjectives: objectives,
        targetAgeMin,
        targetAgeMax,
      };

      // Generate with streaming events
      await recipeAIService.generateRecipeDraftWithEvents(
        input,
        (step) => {
          sendSSEEvent(res, 'step', step);
        },
        (progress) => {
          sendSSEEvent(res, 'progress', { progress });
        },
        (error) => {
          req.logger?.error({ err: error }, '[AI Recipe SSE] Generation error');
          sendSSEEvent(res, 'error', {
            message: error instanceof Error ? error.message : 'Generation failed',
            code: 'GENERATION_ERROR',
          });
        },
      );

      // Send completion event
      sendSSEEvent(res, 'complete', { status: 'complete' });
      req.logger?.info('[AI Recipe SSE] Generation complete');

      res.end();
    } catch (error) {
      req.logger?.error({ err: error }, '[AI Recipe SSE] Stream error');
      if (!res.writableEnded) {
        sendSSEEvent(res, 'error', {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'STREAM_ERROR',
        });
        res.end();
      }
    }

    req.on('close', () => {
      req.logger?.info('[AI Recipe SSE] Client disconnected');
    });
  }) as any);

  return router;
}
