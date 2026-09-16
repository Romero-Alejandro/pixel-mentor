import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import type { UserRole } from '@/features/auth/domain/entities/user.entity';
import { checkOwnership } from '@/features/class/infrastructure/http/middlewares/class-middleware.js';
import type { ContentAccessService } from '@/features/group/application/services/content-access.service.js';
import { requireRole } from '@/features/auth/infrastructure/http/auth.middleware.js';
import type { AppRequest } from '@/shared/types/express.d';
import type { StaticContent } from '@/shared/dto/index';
import type {
  ClassService,
  CreateClassInput,
  UpdateClassInput,
  UpdateLessonInput,
} from '@/features/class/application/services/class.service';
import {
  ClassEnrollmentError,
  LessonNotFoundError,
} from '@/features/class/application/services/class.service';
import type { IClassLessonRepository } from '@/features/class/domain/ports/class.repository.port';
import type { ClassStatus } from '@/features/class/domain/entities/class.entity';
import type { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case';
import type { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case';

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

const ClassListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const AgeRangeSchema = z
  .object({
    targetAgeMin: z.number().int().min(3).max(18).optional(),
    targetAgeMax: z.number().int().min(3).max(18).optional(),
  })
  .refine(
    (data) =>
      data.targetAgeMin === undefined ||
      data.targetAgeMax === undefined ||
      data.targetAgeMin <= data.targetAgeMax,
    { message: 'targetAgeMin must be <= targetAgeMax' },
  );

const CreateClassSchema = z.object({
  body: AgeRangeSchema.extend({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    lessons: z
      .array(
        z.object({
          recipeId: z.string().min(1),
          order: z.number().int().min(0).optional(),
        }),
      )
      .max(50)
      .optional(),
  }),
});

const UpdateClassSchema = z.object({
  body: AgeRangeSchema.extend({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
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
  body: z
    .object({
      targetAgeMin: z.number().min(3).max(18).optional(),
      targetAgeMax: z.number().min(3).max(18).optional(),
      objectives: z.array(z.string()).min(3).max(10).optional(),
    })
    .refine(
      (data) =>
        data.targetAgeMin === undefined ||
        data.targetAgeMax === undefined ||
        data.targetAgeMin <= data.targetAgeMax,
      { message: 'targetAgeMin must be <= targetAgeMax' },
    )
    .default({}),
});

export interface ClassRouterDependencies {
  classService: ClassService;
  classLessonRepository: IClassLessonRepository;
  startRecipeUseCase: StartRecipeUseCase;
  orchestrateUseCase: OrchestrateRecipeUseCase;
  contentAccessService: ContentAccessService;
}

/**
 * Narrow the auth middleware's string role into the domain UserRole union.
 * Unknown values fall back to the most restricted role (STUDENT), matching
 * the adapter's else-branch semantics.
 */
const USER_ROLES: readonly UserRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];
function toUserRole(role: string): UserRole {
  const roleMatch = USER_ROLES.find((candidate) => candidate === role);
  return roleMatch ?? 'STUDENT';
}

/**
 * Wrap a typed AppRequest handler so it satisfies Express 5's RequestHandler
 * (whose request is the base Request). The assertion is safe: auth middleware
 * has already populated `user` by the time these routes run.
 */
const handler =
  (fn: (req: AppRequest, res: Response, next: NextFunction) => Promise<void> | void) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req as AppRequest, res, next);
  };

export function createClassRouter(deps: ClassRouterDependencies): Router {
  const {
    classService,
    classLessonRepository,
    startRecipeUseCase,
    orchestrateUseCase,
    contentAccessService,
  } = deps;
  const router = Router();

  const validate =
    (schema: z.ZodTypeAny) =>
    (req: Request, _res: Response, next: NextFunction): void => {
      schema
        .parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        })
        .then((parsed: unknown) => {
          if (parsed !== null && typeof parsed === 'object' && 'body' in parsed) {
            req.body = (parsed as { body: unknown }).body;
          }
          next();
          return undefined;
        })
        .catch((error: unknown) => {
          next(error);
        });
    };

  const requireTeacherOrAdmin = requireRole('TEACHER', 'ADMIN');

  router.post(
    '/:id/preview',
    requireTeacherOrAdmin,
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const userId = req.user!.id;

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
    }),
  );

  router.get(
    '/lessons/:lessonId/class',
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const { lessonId } = req.params;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const classId = await classLessonRepository.findClassIdByLessonId(lessonId as string);
        if (!classId) throw new LessonNotFoundError(lessonId as string);

        const canAccess = await contentAccessService.canAccessClass(
          userId,
          toUserRole(userRole),
          classId,
        );
        if (!canAccess) {
          throw new ClassEnrollmentError(classId, userId);
        }
        const lesson = await classService.getLesson(classId, lessonId as string);
        res.status(200).json(lesson);
      } catch (error) {
        next(error);
      }
    }),
  );

  // PATCH /:id/lessons/reorder - Reorder lessons (single registration)
  router.patch(
    '/:id/lessons/reorder',
    requireTeacherOrAdmin,
    validate(ReorderLessonsSchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        await classService.reorderLessons(classId, req.user!.id, req.body.lessonIds);
        res.status(200).json({ message: 'Lessons reordered successfully' });
      } catch (error) {
        next(error);
      }
    }),
  );

  router.patch(
    '/:id/lessons/:lessonId',
    requireTeacherOrAdmin,
    validate(UpdateLessonSchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
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
    }),
  );

  // POST /:id/lessons - Add lesson to class
  router.post(
    '/:id/lessons',
    requireTeacherOrAdmin,
    validate(AddLessonSchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const lesson = await classService.addLesson(classId, req.user!.id, req.body);
        res.status(201).json(lesson);
      } catch (error) {
        next(error);
      }
    }),
  );

  // DELETE /:id/lessons/:lessonId - Remove lesson from class
  router.delete(
    '/:id/lessons/:lessonId',
    requireTeacherOrAdmin,
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const lessonId = req.params.lessonId as string;
        await classService.removeLesson(classId, lessonId, req.user!.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }),
  );

  // POST / - Create class (zod-validated)
  router.post(
    '/',
    requireTeacherOrAdmin,
    validate(CreateClassSchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classEntity = await classService.createClass(
          req.user!.id,
          req.body as CreateClassInput,
        );
        res.status(201).json(classEntity);
      } catch (error) {
        next(error);
      }
    }),
  );

  // PATCH /:id - Update class (zod-validated)
  router.patch(
    '/:id',
    requireTeacherOrAdmin,
    validate(UpdateClassSchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const classEntity = await classService.updateClass(
          classId,
          req.user!.id,
          req.body as UpdateClassInput,
        );
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    }),
  );

  // DELETE /:id - Delete class
  router.delete(
    '/:id',
    requireTeacherOrAdmin,
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        await classService.deleteClass(classId, req.user!.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }),
  );

  // POST /:id/demo - Demo class
  router.post(
    '/:id/demo',
    requireTeacherOrAdmin,
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const userId = req.user!.id;
        const classEntity = await classService.getClass(classId);
        if (classEntity.tutorId !== userId && req.user?.role !== 'ADMIN') {
          res.status(403).json({ error: `Class ${classId} does not belong to user ${userId}` });
          return;
        }
        const lessons = await classLessonRepository.findByClassId(classId);
        if (lessons.length === 0) {
          res.status(400).json({ error: 'Class has no lessons' });
          return;
        }
        const firstLesson = lessons.find((l) => l.recipeId);
        if (!firstLesson?.recipeId) {
          res.status(400).json({ error: 'No lesson with associated recipe found' });
          return;
        }
        const { sessionId } = await startRecipeUseCase.execute(firstLesson.recipeId, userId);
        res.status(200).json({
          sessionId,
          recipeId: firstLesson.recipeId,
          title: firstLesson.recipe?.title ?? null,
        });
      } catch (error) {
        next(error);
      }
    }),
  );

  router.get(
    '/:id',
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        if (userRole === 'STUDENT') {
          const canAccess = await contentAccessService.canAccessClass(
            userId,
            toUserRole(userRole),
            classId,
          );
          if (!canAccess) {
            throw new ClassEnrollmentError(classId, userId);
          }
          const classEntity = await classService.getClass(classId);
          if (classEntity.status !== 'PUBLISHED') {
            // Students must never see drafts even if a stale assignment exists.
            res.status(404).json({ error: 'Class not found' });
            return;
          }
          res.status(200).json(classEntity);
          return;
        }

        await checkOwnership(req, classService, classId);
        const classEntity = await classService.getClass(classId);
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    }),
  );

  // GET / - List classes (TEACHER/ADMIN only - use ContentAccessService for students)
  router.get(
    '/',
    requireTeacherOrAdmin,
    validate(ClassListQuerySchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const { status, page, limit } = req.query as Record<string, string | undefined>;
        const result = await classService.listClasses(req.user!.id, {
          status: status as ClassStatus | undefined,
          page: Number(page ?? 1),
          limit: Number(limit ?? 20),
        });
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }),
  );

  // POST /:id/publish - Publish class (accepts optional target-age update)
  router.post(
    '/:id/publish',
    requireTeacherOrAdmin,
    validate(PublishClassSchema),
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const { targetAgeMin, targetAgeMax } = req.body as {
          targetAgeMin?: number;
          targetAgeMax?: number;
        };
        if (targetAgeMin !== undefined || targetAgeMax !== undefined) {
          await classService.updateClass(classId, req.user!.id, {
            targetAgeMin,
            targetAgeMax,
          });
        }
        const classEntity = await classService.publishClass(classId, req.user!.id);
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    }),
  );

  // POST /:id/unpublish - Unpublish class
  router.post(
    '/:id/unpublish',
    requireTeacherOrAdmin,
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const classEntity = await classService.unpublishClass(classId, req.user!.id);
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    }),
  );

  return router;
}

export interface StudentRouterDependencies {
  classService: ClassService;
  classLessonRepository: IClassLessonRepository;
  startRecipeUseCase: StartRecipeUseCase;
  orchestrateUseCase: OrchestrateRecipeUseCase;
  contentAccessService: ContentAccessService;
}

export function createClassLessonStudentRouter(deps: StudentRouterDependencies): Router {
  const {
    classService,
    classLessonRepository,
    startRecipeUseCase,
    orchestrateUseCase,
    contentAccessService,
  } = deps;
  const router = Router();

  // POST /:id/start - Start class (student with enrollment)
  router.post(
    '/:id/start',
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const canAccess = await contentAccessService.canAccessClass(
          userId,
          toUserRole(userRole),
          classId,
        );
        if (!canAccess) {
          throw new ClassEnrollmentError(classId, userId);
        }
        const classEntity = await classService.getClass(classId);
        if (!classEntity) {
          res.status(404).json({ error: 'Class not found' });
          return;
        }
        if (classEntity.status !== 'PUBLISHED') {
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

        const response = {
          sessionId,
          recipeId: firstLesson.recipeId,
          title: firstLesson.recipe?.title ?? null,
          pedagogicalState: interaction.pedagogicalState,
          voiceText: interaction.voiceText,
          meta: interaction.meta,
          isRepeat: interaction.isRepeat ?? false,
          lessonProgress: interaction.lessonProgress,
          contentSteps: interaction.contentSteps,
        };
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    }),
  );

  // GET /:id - Get class by ID (student)
  router.get(
    '/:id',
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const canAccess = await contentAccessService.canAccessClass(
          userId,
          toUserRole(userRole),
          classId,
        );
        if (!canAccess) {
          throw new ClassEnrollmentError(classId, userId);
        }
        const classEntity = await classService.getClass(classId);
        if (!classEntity || classEntity.status !== 'PUBLISHED') {
          res.status(404).json({ error: 'Class not found' });
          return;
        }
        res.status(200).json(classEntity);
      } catch (error) {
        next(error);
      }
    }),
  );

  // GET /:id/lessons - Get lessons for class (student)
  // Authorization: the requester must have access to a PUBLISHED class.
  router.get(
    '/:id/lessons',
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const classId = req.params.id as string;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const canAccess = await contentAccessService.canAccessClass(
          userId,
          toUserRole(userRole),
          classId,
        );
        if (!canAccess) {
          res.status(403).json({
            error: 'No tienes permisos para acceder a esta clase',
            code: 'FORBIDDEN',
          });
          return;
        }

        const classEntity = await classService.getClass(classId);
        if (!classEntity || classEntity.status !== 'PUBLISHED') {
          res.status(404).json({ error: 'Class not found' });
          return;
        }

        const lessons = await classLessonRepository.findByClassId(classId);
        res.status(200).json(lessons);
      } catch (error) {
        next(error);
      }
    }),
  );

  // GET /lessons/:lessonId/class - Get class for a lesson (student)
  router.get(
    '/lessons/:lessonId/class',
    handler(async (req: AppRequest, res: Response, next: NextFunction) => {
      try {
        const { lessonId } = req.params;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        const classId = await classLessonRepository.findClassIdByLessonId(lessonId as string);
        if (!classId) throw new LessonNotFoundError(lessonId as string);

        const canAccess = await contentAccessService.canAccessClass(
          userId,
          toUserRole(userRole),
          classId,
        );
        if (!canAccess) {
          throw new ClassEnrollmentError(classId, userId);
        }
        const classEntity = await classService.getClass(classId);
        if (!classEntity || classEntity.status !== 'PUBLISHED') {
          res.status(404).json({ error: 'Class not found' });
          return;
        }
        const lesson = await classService.getLesson(classId, lessonId as string);
        res.status(200).json(lesson);
      } catch (error) {
        next(error);
      }
    }),
  );

  return router;
}
