/**
 * Class HTTP Routes
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/shared/types/express.d';
import type {
  ClassService,
  CreateClassInput,
  UpdateClassInput,
  AddLessonInput,
  UpdateLessonInput,
  ListClassesOptions,
} from '@/features/class/application/services/class.service';
import {
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  LessonNotFoundError,
} from '@/features/class/application/services/class.service';
import type { IClassLessonRepository } from '@/features/class/domain/ports/class.repository.port';
import type { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case';

const ClassCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  classTemplateId: z.string().optional(),
  lessons: z
    .array(
      z.object({
        recipeId: z.string().min(1),
        order: z.number(),
      }),
    )
    .optional(),
});

const ClassUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  classTemplateId: z.string().optional(),
});

const ClassListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

const AddLessonSchema = z.object({
  recipeId: z.string().min(1),
  order: z.number().int().min(0).optional(),
});

const ReorderLessonsSchema = z.object({
  lessonIds: z.array(z.string().min(1)).min(1),
});

const UpdateLessonSchema = z.object({
  recipeId: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
});

export interface ClassRouterDependencies {
  classService: ClassService;
  classLessonRepository: IClassLessonRepository;
  startRecipeUseCase: StartRecipeUseCase;
}

export function createClassRouter(deps: ClassRouterDependencies): Router {
  const { classService, classLessonRepository, startRecipeUseCase } = deps;
  const router = Router();

  // @ts-expect-error - Express 5 compatibility
  router.post('/', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = ClassCreateSchema.parse(req.body);
      const input: CreateClassInput = {
        title: validatedData.title,
        description: validatedData.description,
        lessons: validatedData.lessons?.map((l, index) => ({
          recipeId: l.recipeId,
          order: l.order ?? index,
        })),
      };

      const classEntity = await classService.createClass(tutorId, input);
      res.status(201).json(classEntity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.get('/', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const queryParams = ClassListQuerySchema.parse({
        status: req.query.status,
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      });

      const options: ListClassesOptions = {
        status: queryParams.status,
        page: queryParams.page,
        limit: queryParams.limit,
      };

      const result = await classService.listClasses(tutorId, options);
      res.status(200).json(result);
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
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const classEntity = await classService.getClass(id);

      if (classEntity.tutorId !== tutorId && req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: You do not own this class' });
        return;
      }

      res.status(200).json(classEntity);
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
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

      const validatedData = ClassUpdateSchema.parse(req.body);
      const input: UpdateClassInput = {
        title: validatedData.title,
        description: validatedData.description,
      };

      const updatedClass = await classService.updateClass(id, tutorId, input);
      res.status(200).json(updatedClass);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.delete('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await classService.deleteClass(id, tutorId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.post('/:id/publish', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const publishedClass = await classService.publishClass(id, tutorId);
      res.status(200).json(publishedClass);
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.name === 'ClassValidationError') {
        res.status(422).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.post('/:id/unpublish', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const unpublishedClass = await classService.unpublishClass(id, tutorId);
      res.status(200).json(unpublishedClass);
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.post('/:id/lessons', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = AddLessonSchema.parse(req.body);
      const input: AddLessonInput = {
        recipeId: validatedData.recipeId,
        order: validatedData.order,
      };

      const lesson = await classService.addLesson(id, tutorId, input);
      res.status(201).json(lesson);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.patch('/:id/lessons/reorder', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = ReorderLessonsSchema.parse(req.body);
      await classService.reorderLessons(id, tutorId, validatedData.lessonIds);
      res.status(200).json({ message: 'Lessons reordered successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof LessonNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.delete('/:id/lessons/:lessonId', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const lessonId = req.params.lessonId as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await classService.removeLesson(id, lessonId, tutorId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof LessonNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.patch('/:id/lessons/:lessonId', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const lessonId = req.params.lessonId as string;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = UpdateLessonSchema.parse(req.body);
      const input: UpdateLessonInput = {
        recipeId: validatedData.recipeId,
        order: validatedData.order,
      };

      const lesson = await classService.updateLesson(id, lessonId, tutorId, input);
      res.status(200).json(lesson);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof LessonNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassStateError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // @ts-expect-error - Express 5 compatibility
  router.post('/:id/demo', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const classId = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const classEntity = await classService.getClass(classId);
      if (!classEntity) {
        throw new ClassNotFoundError(classId);
      }
      if (classEntity.tutorId !== userId && req.user?.role !== 'ADMIN') {
        throw new ClassOwnershipError(classId, userId);
      }

      const lessons = await classLessonRepository.findByClassId(classId);
      if (lessons.length === 0) {
        res.status(400).json({ error: 'Class has no lessons' });
        return;
      }

      const firstLesson = lessons.find((l) => l.recipeId);
      if (!firstLesson) {
        res.status(400).json({ error: 'No lesson with associated recipe found' });
        return;
      }

      const { sessionId } = await startRecipeUseCase.execute(firstLesson.recipeId, userId);
      res.status(200).json({ sessionId, recipeId: firstLesson.recipeId, title: firstLesson.recipe?.title ?? null });
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ClassOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return router;
}
