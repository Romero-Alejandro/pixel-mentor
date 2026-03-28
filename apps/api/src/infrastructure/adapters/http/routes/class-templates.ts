/**
 * Class Template Routes
 *
 * REST API endpoints for class template management.
 * All routes require TEACHER role authentication.
 */

import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/types/express.js';
import type {
  ClassTemplateService,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateClassFromTemplateInput,
} from '@/application/services/class-template.service.js';
import {
  TemplateNotFoundError,
  TemplateOwnershipError,
} from '@/application/services/class-template.service.js';

// Inline schemas to avoid module resolution issues
const ClassTemplateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const ClassTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const CreateClassFromTemplateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export interface ClassTemplateRouterDependencies {
  classTemplateService: ClassTemplateService;
}

export function createClassTemplateRouter(deps: ClassTemplateRouterDependencies): Router {
  const { classTemplateService } = deps;
  const router = Router();

  /**
   * GET /api/class-templates - List tutor's templates
   * Auth: TEACHER role required
   */
  router.get('/', async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check TEACHER role
      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      const templates = await classTemplateService.listTemplates(tutorId);

      res.status(200).json({ templates });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/class-templates - Create a new template
   * Auth: TEACHER role required
   */
  router.post('/', async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check TEACHER role
      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      // Parse and validate request body
      const validatedData = ClassTemplateCreateSchema.parse(req.body);

      const input: CreateTemplateInput = {
        name: validatedData.name,
        description: validatedData.description,
      };

      const template = await classTemplateService.createTemplate(tutorId, input);

      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /api/class-templates/:id - Get template details
   * Auth: TEACHER role required
   */
  router.get('/:id', async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check TEACHER role
      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      const template = await classTemplateService.getTemplate(id);

      // Check ownership (or admin can view any)
      if (template.tutorId !== tutorId && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: You do not own this template' });
        return;
      }

      res.status(200).json(template);
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  /**
   * PATCH /api/class-templates/:id - Update template
   * Auth: TEACHER role required
   */
  router.patch(
    '/:id',
    async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params.id as string;
        const tutorId = req.user?.id;

        if (!tutorId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Check TEACHER role
        if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: 'Forbidden: TEACHER role required' });
          return;
        }

        // Parse and validate request body
        const validatedData = ClassTemplateUpdateSchema.parse(req.body);

        const input: UpdateTemplateInput = {
          name: validatedData.name,
          description: validatedData.description,
        };

        const template = await classTemplateService.updateTemplate(id, tutorId, input);

        res.status(200).json(template);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        if (error instanceof TemplateNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof TemplateOwnershipError) {
          res.status(403).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  );

  /**
   * DELETE /api/class-templates/:id - Delete template
   * Auth: TEACHER role required
   */
  router.delete(
    '/:id',
    async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params.id as string;
        const tutorId = req.user?.id;

        if (!tutorId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Check TEACHER role
        if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: 'Forbidden: TEACHER role required' });
          return;
        }

        await classTemplateService.deleteTemplate(id, tutorId);

        res.status(204).send();
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof TemplateOwnershipError) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error instanceof Error) {
          res.status(409).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  );

  /**
   * POST /api/class-templates/:id/create-class - Create class from template
   * Auth: TEACHER role required
   */
  router.post(
    '/:id/create-class',
    async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params.id as string;
        const tutorId = req.user?.id;

        if (!tutorId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Check TEACHER role
        if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: 'Forbidden: TEACHER role required' });
          return;
        }

        // Parse and validate request body (optional)
        let input: CreateClassFromTemplateInput | undefined;
        if (req.body && Object.keys(req.body).length > 0) {
          const validatedData = CreateClassFromTemplateSchema.parse(req.body);
          input = {
            title: validatedData.title,
            description: validatedData.description,
          };
        }

        const result = await classTemplateService.createClassFromTemplate(id, tutorId, input);

        res.status(201).json({ classId: result.classId, title: result.title });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        if (error instanceof TemplateNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof TemplateOwnershipError) {
          res.status(403).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
