/**
 * Class Template Routes
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/shared/types/express.d';
import type {
  ClassTemplateService,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateClassFromTemplateInput,
} from '@/features/class/application/services/class-template.service';
import {
  TemplateNotFoundError,
  TemplateOwnershipError,
} from '@/features/class/application/services/class-template.service';
import { GetClassParamsSchema, DeleteClassParamsSchema } from '@/shared/dto/index';

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

  // @ts-expect-error - Express 5 compatibility
  router.get('/', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      const templates = await classTemplateService.listTemplates(tutorId);
      res.status(200).json({ templates });
    } catch (error) {
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.post('/', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

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
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.get('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const validated = GetClassParamsSchema.parse({ id: req.params.id as string });
      const id = validated.id;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      const template = await classTemplateService.getTemplate(id);

      if (template.tutorId !== tutorId && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: You do not own this template' });
        return;
      }

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
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.patch('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

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
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.delete('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const validated = DeleteClassParamsSchema.parse({ id: req.params.id as string });
      const id = validated.id;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

      await classTemplateService.deleteTemplate(id, tutorId);
      res.status(204).send();
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
      if (error instanceof Error) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.post('/:id/create-class', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user?.role !== 'TEACHER' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: TEACHER role required' });
        return;
      }

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
      throw error;
    }
  });

  return router;
}
