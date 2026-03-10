import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { GetLessonUseCase } from '@/application/use-cases/lesson/get-lesson.use-case';
import type { ListLessonsUseCase } from '@/application/use-cases/lesson/list-lessons.use-case';
import { GetLessonInputSchema, ListLessonsInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createLessonsRouter(
  getLessonUseCase: GetLessonUseCase,
  listLessonsUseCase: ListLessonsUseCase,
): Router {
  const router = Router();

  router.get(
    '/:id',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = GetLessonInputSchema.parse({ lessonId: request.params.id });

        const lesson = await getLessonUseCase.execute(validated.lessonId);

        response.json(lesson);
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
        const query: { activeOnly?: boolean } = {};
        const rawActiveOnly = request.query.activeOnly;
        if (rawActiveOnly !== undefined) {
          const val = Array.isArray(rawActiveOnly) ? rawActiveOnly[0] : rawActiveOnly;
          query.activeOnly = val === 'true';
        }

        const validated = ListLessonsInputSchema.parse(query);

        const lessons = await listLessonsUseCase.execute(validated.activeOnly);

        response.json(lessons);
      } catch (error) {
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
