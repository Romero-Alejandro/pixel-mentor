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

  return router;
}
