import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { GetSessionUseCase } from '@/features/session/application/use-cases/get-session.use-case';
import type { ListSessionsUseCase } from '@/features/session/application/use-cases/list-sessions.use-case';
import type { ResetSessionUseCase } from '@/features/session/application/use-cases/reset-session.use-case';
import type { CompleteSessionUseCase } from '@/features/session/application/use-cases/complete-session.use-case';
import type { AppRequest } from '@/shared/types/express.d.js';
import type { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case';
import type { IClassLessonRepository } from '@/features/class/domain/ports/class.repository.port';
import type { ContentAccessService } from '@/features/group/application/services/content-access.service';
import {
  LessonNotFoundError,
  ClassEnrollmentError,
} from '@/features/class/application/services/class.service';
import { RecipeNotFoundError } from '@/features/recipe/domain/ports/recipe.repository.port';
import {
  GetSessionInputSchema,
  ListSessionsInputSchema,
  ReplaySessionParamsSchema,
  CompleteSessionParamsSchema,
} from '@/shared/dto/index';

export function createSessionsRouter(
  getSessionUseCase: GetSessionUseCase,
  listSessionsUseCase: ListSessionsUseCase,
  resetSessionUseCase: ResetSessionUseCase,
  completeSessionUseCase: CompleteSessionUseCase,
  startRecipeUseCase: StartRecipeUseCase,
  contentAccessService: ContentAccessService,
  classLessonRepository: IClassLessonRepository,
): Router {
  const router = Router();

  router.get(
    '/:id',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const sessionId = request.params.id as string;
        const validated = GetSessionInputSchema.parse({ sessionId });

        const session = await getSessionUseCase.execute(validated.sessionId);

        if (!session) {
          response.status(404).json({ error: 'Session not found' });
          return;
        }

        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.json(session);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.get(
    '/',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        // Normalize query params (Express can give string or string[])
        const rawStudentId = request.query.studentId as string | string[] | undefined;
        const studentId = Array.isArray(rawStudentId)
          ? rawStudentId[0]
          : typeof rawStudentId === 'string'
            ? rawStudentId
            : undefined;

        const query: { studentId?: string; activeOnly?: boolean } = {};
        if (studentId) query.studentId = studentId;

        const rawActiveOnly = request.query.activeOnly as string | string[] | boolean | undefined;
        if (rawActiveOnly !== undefined) {
          const val = Array.isArray(rawActiveOnly) ? rawActiveOnly[0] : rawActiveOnly;
          query.activeOnly = val === 'true';
        }

        const validated = ListSessionsInputSchema.parse(query);

        const sessions = await listSessionsUseCase.execute(
          validated.studentId,
          validated.activeOnly,
        );

        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.json(sessions);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/:id/replay',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const params = ReplaySessionParamsSchema.parse(request.params);
        const result = await resetSessionUseCase.execute(params.id);
        response.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/:id/complete',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const params = CompleteSessionParamsSchema.parse(request.params);
        const result = await completeSessionUseCase.execute(params.id);
        response.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/start-recipe',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      const appRequest = request as AppRequest;
      const studentId = appRequest.user!.id;

      const StartRecipeSchema = z.object({
        recipeId: z.string().uuid(),
      });

      try {
        const validated = StartRecipeSchema.parse(appRequest.body);
        const { recipeId } = validated;

        const { sessionId, resumed, classLessonId } = await startRecipeUseCase.execute(
          recipeId,
          studentId,
        );

        response.status(200).json({ sessionId, resumed, classLessonId });
      } catch (error) {
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        if (error instanceof RecipeNotFoundError) {
          response.status(404).json({ error: 'Recipe not found', code: 'RECIPE_NOT_FOUND' });
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    '/start-lesson',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      const appRequest = request as AppRequest;
      const studentId = appRequest.user!.id;
      const userRole = appRequest.user!.role as 'STUDENT' | 'TEACHER' | 'ADMIN';

      const StartLessonSchema = z.object({
        lessonId: z.string().min(1),
      });

      try {
        const validated = StartLessonSchema.parse(appRequest.body);
        const { lessonId } = validated;

        // 1. Find classId from lessonId
        const classId = await classLessonRepository.findClassIdByLessonId(lessonId);
        if (!classId) {
          throw new LessonNotFoundError(lessonId);
        }

        // 2. Check if student has access to the class using ContentAccessService
        const canAccess = await contentAccessService.canAccessClass(studentId, userRole, classId);
        if (!canAccess) {
          throw new ClassEnrollmentError(classId, studentId);
        }

        // 3. Get recipeId from lessonId
        const lesson = await classLessonRepository.findById(lessonId);
        if (!lesson || !lesson.recipeId) {
          throw new LessonNotFoundError(lessonId);
        }
        const recipeId = lesson.recipeId;

        // 4. Start the recipe session
        const { sessionId, resumed } = await startRecipeUseCase.execute(recipeId, studentId);

        response.status(200).json({ sessionId, resumed, classLessonId: lessonId });
      } catch (error) {
        if (error instanceof LessonNotFoundError || error instanceof ClassEnrollmentError) {
          response.status(403).json({ error: error.message, code: error.code });
          return;
        }
        if (error instanceof z.ZodError) {
          response.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
