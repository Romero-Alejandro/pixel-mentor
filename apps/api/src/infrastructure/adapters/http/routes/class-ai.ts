/**
 * Class AI Routes
 *
 * REST API endpoints for AI-powered class features.
 * All routes require TEACHER role authentication.
 */

import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/types/express.js';
import type {
  ClassAIService,
  GenerateClassDraftInput,
} from '@/application/services/class-ai.service.js';
import { ClassNotFoundError } from '@/application/services/class.service.js';
import { SuggestImprovementsParamsSchema } from '@/application/dto/index.js';

// Inline schema to avoid module resolution issues
const GenerateClassDraftInputSchema = z.object({
  topic: z.string().min(1).max(500),
  targetAgeMin: z.number().min(3).max(18),
  targetAgeMax: z.number().min(3).max(18),
  objectives: z.array(z.string()).min(3).max(10),
  duration: z.number().min(15).max(180).optional(),
  availableRecipes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

export interface ClassAIRouterDependencies {
  classAIService: ClassAIService;
}

/**
 * Create router for AI generation at /api/classes/ai
 */
export function createClassAIRouter(deps: ClassAIRouterDependencies): Router {
  const { classAIService } = deps;
  const router = Router();

  /**
   * POST /api/classes/ai/generate - Generate AI draft for a class
   * Auth: TEACHER role required
   */
  router.post(
    '/generate',
    // @ts-expect-error - Express 5 compatibility
    async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Check TEACHER role
        if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: 'Forbidden: TEACHER role required' });
          return;
        }

        // Parse and validate request body
        const validatedData = GenerateClassDraftInputSchema.parse(req.body);

        const input: GenerateClassDraftInput = {
          topic: validatedData.topic,
          learningObjectives: validatedData.objectives,
          targetAudience: undefined,
          duration: validatedData.duration,
          numberOfLessons: undefined,
        };

        const draft = await classAIService.generateClassDraft(input);

        res.status(200).json(draft);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}

/**
 * Create router for AI suggestions at /api/classes/:id/ai
 */
export function createClassAISuggestionsRouter(deps: ClassAIRouterDependencies): Router {
  const { classAIService } = deps;
  const router = Router();

  /**
   * GET /api/classes/:id/ai/suggestions - Get AI improvement suggestions
   * Auth: TEACHER role required
   */
  router.get(
    '/suggestions',
    // @ts-expect-error - Express 5 compatibility
    async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Validate classId parameter
        const rawId = req.params.id as string;
        const { id: classId } = SuggestImprovementsParamsSchema.parse({ id: rawId });

        // Check TEACHER role
        if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: 'Forbidden: TEACHER role required' });
          return;
        }

        const suggestions = await classAIService.suggestImprovements(classId);

        res.status(200).json({ suggestions });
      } catch (error) {
        if (error instanceof ClassNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
