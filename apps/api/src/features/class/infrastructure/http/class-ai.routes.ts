/**
 * Class AI Routes
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/shared/types/express.d';
import type {
  ClassAIService,
  GenerateClassDraftInput,
} from '@/features/class/application/services/class-ai.service';
import { ClassNotFoundError } from '@/features/class/application/services/class.service';
import { SuggestImprovementsParamsSchema } from '@/shared/dto/index';
import {
  llmGovernanceMiddleware,
  recordLLMUsage,
} from '@/shared/http/llm-governance.middleware.js';

const GenerateClassDraftInputSchema = z.object({
  topic: z.string().min(1).max(500),
  targetAgeMin: z.number().min(3).max(18),
  targetAgeMax: z.number().min(3).max(18),
  objectives: z.array(z.string()).min(3).max(10),
  duration: z.number().min(15).max(180).optional(),
});

export interface ClassAIRouterDependencies {
  classAIService: ClassAIService;
}

export function createClassAIRouter(deps: ClassAIRouterDependencies): Router {
  const { classAIService } = deps;
  const router = Router();
  const llmGovernance = llmGovernanceMiddleware();

  // @ts-expect-error - Express 5 compatibility
  router.post('/generate', llmGovernance, async (req: AppRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      const validatedData = GenerateClassDraftInputSchema.parse(req.body);
      const input: GenerateClassDraftInput = {
        topic: validatedData.topic,
        learningObjectives: validatedData.objectives,
        targetAudience: undefined,
        duration: validatedData.duration,
      };

      const draft = await classAIService.generateClassDraft(input);

      // Record LLM usage
      recordLLMUsage(
        req,
        `class-generate:${validatedData.topic}`,
        JSON.stringify(draft).slice(0, 500),
        true,
      );

      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      // Record failed LLM usage
      recordLLMUsage(
        req,
        'class-generate',
        '',
        false,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  return router;
}

export function createClassAISuggestionsRouter(deps: ClassAIRouterDependencies): Router {
  const { classAIService } = deps;
  const router = Router();
  const llmGovernance = llmGovernanceMiddleware();

  router.get(
    '/suggestions',
    llmGovernance,
    // @ts-expect-error - Express 5 compatibility with AppRequest type
    async (req: AppRequest, res: Response): Promise<void> => {
      try {
        const rawId = req.params.id as string;
        const { id: classId } = SuggestImprovementsParamsSchema.parse({ id: rawId });

        if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: 'Forbidden: TEACHER role required' });
          return;
        }

        const suggestions = await classAIService.suggestImprovements(classId);

        // Record LLM usage
        recordLLMUsage(
          req,
          `class-suggestions:${classId}`,
          JSON.stringify(suggestions).slice(0, 500),
          true,
        );

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
        // Record failed LLM usage
        recordLLMUsage(
          req,
          'class-suggestions',
          '',
          false,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    },
  );

  return router;
}
