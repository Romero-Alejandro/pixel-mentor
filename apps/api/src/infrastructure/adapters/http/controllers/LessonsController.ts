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

export class LessonsController {
  constructor(
    private getLessonUseCase: GetLessonUseCase,
    private listLessonsUseCase: ListLessonsUseCase,
  ) {}

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = GetLessonInputSchema.parse({ lessonId: req.params.id });
      const lesson = await this.getLessonUseCase.execute(validated.lessonId);
      res.json(lesson);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: { activeOnly?: boolean } = {};
      const rawActiveOnly = req.query.activeOnly;
      if (rawActiveOnly !== undefined) {
        const val = Array.isArray(rawActiveOnly) ? rawActiveOnly[0] : rawActiveOnly;
        query.activeOnly = val === 'true';
      }

      const validated = ListLessonsInputSchema.parse(query);
      const lessons = await this.listLessonsUseCase.execute(validated.activeOnly);
      res.json(lessons);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }
}

export function createLessonsRouter(controller: LessonsController): Router {
  const router = Router();
  router.get('/:id', controller.get.bind(controller));
  router.get('/', controller.list.bind(controller));
  return router;
}
