import { Router } from 'express';
import { z } from 'zod';
import type { Response, Request, NextFunction } from 'express';

import type { AppRequest } from '@/shared/types/express.d';
import type {
  ClassService,
  CreateClassInput,
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

const validate =
  (schema: z.AnyZodObject) => async (req: Request, _res: Response, next: NextFunction) => {
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

export function createClassRouter(deps: ClassRouterDependencies): Router {
  const { classService, classLessonRepository, startRecipeUseCase, orchestrateUseCase } = deps;
  const router = Router();

  const ensureAuthenticated = (req: AppRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  const checkOwnership = async (req: AppRequest, classId: string) => {
    const userId = req.user!.id;
    const classEntity = await classService.getClass(classId);
    if (classEntity.tutorId !== userId && req.user?.role !== 'ADMIN') {
      throw new ClassOwnershipError(classId, userId);
    }
    return classEntity;
  };

  router.use(ensureAuthenticated);

  router.post(
    '/',
    validate(ClassCreateSchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const input: CreateClassInput = {
          ...req.body,
          lessons: req.body.lessons?.map((l: any, index: number) => ({
            ...l,
            order: l.order ?? index,
          })),
        };
        const classEntity = await classService.createClass(req.user!.id, input);
        res.status(201).json(classEntity);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/',
    validate(ClassListQuerySchema),
    async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const { status, page, limit } = req.query as any;
        const result = await classService.listClasses(req.user!.id, { status, page, limit });
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/:id', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const classEntity = await checkOwnership(req, req.params.id);
      res.status(200).json(classEntity);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      await classService.deleteClass(req.params.id, req.user!.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/demo', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const classId = req.params.id;
      const userId = req.user!.id;

      await checkOwnership(req, classId);

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

        // First, try to find by lessonId
        let lesson = await classLessonRepository.findById(lessonId);

        // If not found, try to find by recipeId (support both lessonId and recipeId in URL)
        if (!lesson) {
          const lessons = await classLessonRepository.findByRecipeId(lessonId);
          if (lessons.length > 0) {
            lesson = lessons[0];
          }
        }

        if (!lesson) throw new LessonNotFoundError(lessonId);

        await checkOwnership(req, lesson.classId);
        res.status(200).json({ classId: lesson.classId });
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
        const lesson = await classService.updateLesson(
          req.params.id,
          req.params.lessonId,
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
        const lesson = await classService.addLesson(req.params.id, req.user!.id, req.body);
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
        await classService.removeLesson(req.params.id, req.params.lessonId, req.user!.id);
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
        const classEntity = await classService.publishClass(req.params.id, req.user!.id);
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /:id/unpublish - Unpublish class
  router.post('/:id/unpublish', async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const classEntity = await classService.unpublishClass(req.params.id, req.user!.id);
      res.status(200).json(classEntity);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
