import { Router } from 'express';
import type { ZodObject } from 'zod';
import { z } from 'zod';
import type { Response, Request, NextFunction } from 'express';

import { checkEnrollment, checkOwnership } from './middlewares/class-middleware.js';

import type { AppRequest } from '@/shared/types/express.d';
import type {
  ClassService,
  CreateClassInput,
  UpdateLessonInput,
} from '@/features/class/application/services/class.service';
import {
  ClassNotFoundError,
  ClassOwnershipError,
  LessonNotFoundError,
} from '@/features/class/application/services/class.service';
import type { IClassLessonRepository } from '@/features/class/domain/ports/class.repository.port';
import type { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case';
import type { StaticContent } from '@/shared/dto/index';

interface DemoInteractionOutput {
  voiceText: string;
  pedagogicalState: string;
  staticContent: StaticContent;
  meta?: Record<string, unknown>;
  contentSteps?: Array<{
    stepIndex: number;
    stepType: string;
    staticContent: StaticContent;
  }>;
  lessonProgress: {
    currentStep: number;
    totalSteps: number;
  };
  isRepeat?: boolean;
}

const ClassCreateSchema = z.object({
  body: z.object({
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
  }),
});

const ClassUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
  }),
});

const ClassListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const AddLessonSchema = z.object({
  body: z.object({
    recipeId: z.string().min(1),
    order: z.number().int().min(0).optional(),
  }),
});

const UpdateLessonSchema = z.object({
  body: z.object({
    recipeId: z.string().min(1).optional(),
    order: z.number().int().min(0).optional(),
  }),
});

const ReorderLessonsSchema = z.object({
  body: z.object({
    lessonIds: z.array(z.string().min(1)).min(1),
  }),
});

const PublishClassSchema = z.object({
  body: z.object({
    targetAgeMin: z.number().min(3).max(18).optional(),
    targetAgeMax: z.number().min(3).max(18).optional(),
    objectives: z.array(z.string()).min(3).max(10).optional(),
  }),
});

export interface ClassRouterDependencies {
  classService: ClassService;
  classLessonRepository: IClassLessonRepository;
  startRecipeUseCase: StartRecipeUseCase;
  orchestrateUseCase: any;
}

export function createClassRouter(deps: ClassRouterDependencies): Router {
  const { classService, classLessonRepository, startRecipeUseCase, orchestrateUseCase } = deps;
  const router = Router();

  const validate =
    (schema: ZodObject<any>) => async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        req.body = parsed.body ?? req.body;
        // req.query = (parsed.query as any) ?? req.query;
        // req.params = parsed.params ?? req.params;
        next();
      } catch (error) {
        next(error);
      }
    };

  router.post('/:id/preview', async (req: AppRequest, res: Response, next: NextFunction) => {
    console.log(
      `[DEBUG] Solicitud a /preview: userId=${req.user?.id}, role=${req.user?.role}, classId=${req.params.id}`,
    );
    try {
      const classId = req.params.id as string;
      const userId = req.user!.id;

      console.log(`[DEBUG] Verificando ownership: classId=${classId}, userId=${userId}`);
      await checkOwnership(req, classService, classId);

      // Validar que la clase esté en estado DRAFT (solo para previsualización)
      const classEntity = await classService.getClass(classId);
      if (classEntity.status !== 'DRAFT') {
        res.status(403).json({
          error: 'Preview is only available for classes in DRAFT state',
        });
        return;
      }

      const lessons = await classLessonRepository.findByClassId(classId);
      const firstLesson = lessons.find((l) => l.recipeId);

      if (!firstLesson?.recipeId) {
        res.status(400).json({ error: 'Class has no valid lessons with recipes' });
        return;
      }

      const { sessionId } = await startRecipeUseCase.execute(firstLesson.recipeId, userId);
      const interaction = (await orchestrateUseCase.interact(
        sessionId,
        '',
      )) as DemoInteractionOutput;

      res.status(200).json({
        sessionId,
        recipeId: firstLesson.recipeId,
        title: firstLesson.recipe?.title ?? null,
        pedagogicalState: interaction.pedagogicalState,
        voiceText: interaction.voiceText,
        meta: interaction.meta,
        isRepeat: interaction.isRepeat ?? false,
        lessonProgress: interaction.lessonProgress,
        contentSteps: interaction.contentSteps,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/lessons/:lessonId/class',
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const { lessonId } = req.params;

        const classId = await classLessonRepository.findClassIdByLessonId(lessonId as string);
        if (!classId) throw new LessonNotFoundError(lessonId as string);

        await checkEnrollment(req, classService, classId);
        const lesson = await classService.getLesson(classId, lessonId as string);
        res.status(200).json(lesson);
      } catch (error) {
        next(error);
      }
    },
  );

  // PATCH /:id/lessons/reorder - Reorder lessons (MUST be before /:lessonId)
  router.patch(
    '/:id/lessons/reorder',
    validate(ReorderLessonsSchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        await classService.reorderLessons(classId, req.user!.id, req.body.lessonIds);
        res.status(200).json({ message: 'Lessons reordered' });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    '/:id/lessons/:lessonId',
    validate(UpdateLessonSchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const lessonId = req.params.lessonId as string;
        const lesson = await classService.updateLesson(
          classId,
          lessonId,
          req.user!.id,
          req.body as UpdateLessonInput,
        );
        res.status(200).json(lesson);
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /:id/lessons - Add lesson to class
  router.post(
    '/:id/lessons',
    validate(AddLessonSchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const lesson = await classService.addLesson(classId, req.user!.id, req.body);
        res.status(201).json(lesson);
      } catch (error) {
        next(error);
      }
    },
  );

  // DELETE /:id/lessons/:lessonId - Remove lesson from class
  router.delete(
    '/:id/lessons/:lessonId',
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const lessonId = req.params.lessonId as string;
        await classService.removeLesson(classId, lessonId, req.user!.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  // PATCH /:id/lessons/reorder - Reorder lessons
  router.patch(
    '/:id/lessons/reorder',
    validate(ReorderLessonsSchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        await classService.reorderLessons(req.params.id, req.user!.id, req.body.lessonIds);
        res.status(200).json({ message: 'Lessons reordered' });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /:id/publish - Publish class
  router.post(
    '/:id/publish',
    validate(PublishClassSchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const classEntity = await classService.publishClass(classId, req.user!.id);
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /:id/unpublish - Unpublish class
  router.post('/:id/unpublish', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const classId = req.params.id as string;
      const classEntity = await classService.unpublishClass(classId, req.user!.id);
      res.status(200).json(classEntity);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export interface StudentRouterDependencies {
  classService: ClassService;
  classLessonRepository: IClassLessonRepository;
  startRecipeUseCase: StartRecipeUseCase;
  orchestrateUseCase: any;
}

export function createClassLessonStudentRouter(deps: StudentRouterDependencies): Router {
  const { classService, classLessonRepository, startRecipeUseCase, orchestrateUseCase } = deps;
  const router = Router();

  // POST /:id/demo - Start class demo (student with enrollment)
  router.post('/:id/demo', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const classId = req.params.id as string;
      const userId = req.user!.id;

      await checkEnrollment(req, classService, classId);
      const classEntity = await classService.getClass(classId);
      if (!classEntity) {
        res.status(404).json({ error: 'Class not found' });
        return;
      }

      const lessons = await classLessonRepository.findByClassId(classId);
      const firstLesson = lessons.find((l) => l.recipeId);

      if (!firstLesson?.recipeId) {
        res.status(400).json({ error: 'Class has no valid lessons with recipes' });
        return;
      }

      const { sessionId } = await startRecipeUseCase.execute(firstLesson.recipeId, userId);
      const interaction = (await orchestrateUseCase.interact(
        sessionId,
        '',
      )) as DemoInteractionOutput;

      res.status(200).json({
        sessionId,
        recipeId: firstLesson.recipeId,
        title: firstLesson.recipe?.title ?? null,
        pedagogicalState: interaction.pedagogicalState,
        voiceText: interaction.voiceText,
        meta: interaction.meta,
        isRepeat: interaction.isRepeat ?? false,
        lessonProgress: interaction.lessonProgress,
        contentSteps: interaction.contentSteps,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /:id - Get class by ID (student)
  router.get('/:id', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const classEntity = await classService.getClass(req.params.id);
      if (!classEntity) {
        res.status(404).json({ error: 'Class not found' });
        return;
      }
      res.status(200).json(classEntity);
    } catch (error) {
      next(error);
    }
  });

  // GET /:id/lessons - Get lessons for class (student)
  router.get('/:id/lessons', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const lessons = await classLessonRepository.findByClassId(req.params.id);
      res.status(200).json(lessons);
    } catch (error) {
      next(error);
    }
  });

  // GET /lessons/:lessonId/class - Get class for a lesson (student)
  router.get(
    '/lessons/:lessonId/class',
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const { lessonId } = req.params;
        const classId = await classLessonRepository.findClassIdByLessonId(lessonId as string);
        if (!classId) throw new LessonNotFoundError(lessonId as string);
        await checkEnrollment(req, classService, classId);
        const lesson = await classService.getLesson(classId, lessonId as string);
        res.status(200).json(lesson);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
