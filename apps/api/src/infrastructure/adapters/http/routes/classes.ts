/**
 * Class Routes
 *
 * REST API endpoints for class management.
 * All routes require TEACHER role authentication.
 */

import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AppRequest } from '@/types/express.js';
import type {
  ClassService,
  CreateClassInput,
  UpdateClassInput,
  AddLessonInput,
  UpdateLessonInput,
  ListClassesOptions,
} from '@/application/services/class.service.js';
import {
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  LessonNotFoundError,
} from '@/application/services/class.service.js';
import type { IClassLessonRepository } from '@/domain/repositories/class.repository.js';
import type { StartRecipeUseCase } from '@/application/use-cases/recipe/start-recipe.use-case.js';

// Inline schemas to avoid module resolution issues
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
  tutorId: z.string().optional(),
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
  const { classService } = deps;
  const router = Router();

  /**
   * POST /api/classes - Create a new draft class
   * Auth: TEACHER role required
   */
  router.post('/', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parse and validate request body
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

  /**
   * GET /api/classes - List tutor's classes
   * Auth: TEACHER role required
   */
  router.get('/', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const tutorId = req.user?.id;
      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parse query parameters
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

  /**
   * GET /api/classes/:id - Get class details
   * Auth: TEACHER role required
   */
  router.get('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const classEntity = await classService.getClass(id);

      // Check ownership
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

  /**
   * PATCH /api/classes/:id - Update class
   * Auth: TEACHER role required
   */
  router.patch('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parse and validate request body
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

  /**
   * DELETE /api/classes/:id - Delete class
   * Auth: TEACHER role required
   */
  router.delete('/:id', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
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

  /**
   * POST /api/classes/:id/publish - Publish class
   * Auth: TEACHER role required
   */
  router.post('/:id/publish', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
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

  /**
   * POST /api/classes/:id/unpublish - Unpublish class (PUBLISHED -> DRAFT)
   * Auth: TEACHER role required
   */
  router.post('/:id/unpublish', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
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

  /**
   * POST /api/classes/:id/lessons - Add lesson to class
   * Auth: TEACHER role required
   */
  router.post('/:id/lessons', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parse and validate request body
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

  /**
   * PATCH /api/classes/:id/lessons/reorder - Reorder lessons
   * NOTE: This route must be BEFORE /:lessonId routes to avoid "reorder" being parsed as lessonId
   * Auth: TEACHER role required
   */
  router.patch('/:id/lessons/reorder', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parse and validate request body
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

  /**
   * DELETE /api/classes/:id/lessons/:lessonId - Remove lesson from class
   * Auth: TEACHER role required
   */
  router.delete('/:id/lessons/:lessonId', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id, lessonId } = req.params;
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

  /**
   * PATCH /api/classes/:id/lessons/:lessonId - Update a lesson
   * Auth: TEACHER role required
   */
  router.patch('/:id/lessons/:lessonId', async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { id, lessonId } = req.params;
      const tutorId = req.user?.id;

      if (!tutorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Parse and validate request body
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

  /**
   * POST /api/classes/:id/demo - Start demo session for class
   * Auth: TEACHER or ADMIN role required
   * Returns a sessionId to experience the class as a student without restrictions
   */
  router.post(
    '/:id/demo',
    async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
      const { classLessonRepository, startRecipeUseCase } = deps;
      try {
        const classId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Verify class exists and is accessible (ownership or admin)
        const classEntity = await classService.getClass(classId);
        if (!classEntity) {
          throw new ClassNotFoundError(classId);
        }
        if (classEntity.tutorId !== userId && req.user?.role !== 'ADMIN') {
          throw new ClassOwnershipError(classId, userId);
        }

        // Get class lessons
        let lessons = await classLessonRepository.findByClassId(classId);

        // Debug logging
        console.log(
          `[DemoEndpoint] classId=${classId}, totalLessons=${lessons.length}, lessonsWithRecipe=${lessons.filter((l) => l.recipeId).length}`,
        );
        console.log(
          `[DemoEndpoint] lesson details:`,
          lessons.map((l) => ({ id: l.id, recipeId: l.recipeId })),
        );

        if (lessons.length === 0) {
          res.status(400).json({ error: 'Class has no lessons' });
          return;
        }

        // Find first lesson (all lessons now have recipeId)
        const firstLesson = lessons[0];
        if (!firstLesson || !firstLesson.recipeId) {
          res.status(400).json({
            error: 'No lesson with associated recipe found',
            details: {
              totalLessons: lessons.length,
              lessonsWithoutRecipe: lessons.filter((l) => !l.recipeId).length,
            },
          });
          return;
        }

        // Start demo session (unrestricted)
        const { sessionId } = await startRecipeUseCase.execute(firstLesson.recipeId, userId);

        res.status(200).json({
          sessionId,
          recipeId: firstLesson.recipeId,
        });
      } catch (error) {
        if (error instanceof ClassNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof ClassOwnershipError) {
          res.status(403).json({ error: error.message });
          return;
        }
        // Handle other errors (e.g., startRecipeUseCase failure)
        if (error instanceof Error) {
          res.status(500).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    },
  );

  return router;
}
