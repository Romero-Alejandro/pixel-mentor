import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';
import { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case';
import { StartLessonInputSchema, InteractLessonInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export class LeccionController {
  constructor(private orchestrateLessonUseCase: OrchestrateLessonUseCase) {}

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appRequest = req as AppRequest;
      const validated = StartLessonInputSchema.parse(appRequest.body);
      const result = await this.orchestrateLessonUseCase.start(
        validated.lessonId,
        validated.studentId,
      );
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  async interact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appRequest = req as AppRequest;
      const validated = InteractLessonInputSchema.parse(appRequest.body);
      const result = await this.orchestrateLessonUseCase.interact(
        validated.sessionId,
        validated.studentInput,
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }
}

export function createLeccionRouter(controller: LeccionController): Router {
  const router = Router();
  router.post('/start', controller.start.bind(controller));
  router.post('/interact', controller.interact.bind(controller));
  return router;
}
