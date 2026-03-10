import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';
import { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case';
import { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case';
import { GetSessionInputSchema, ListSessionsInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export class SessionsController {
  constructor(
    private getSessionUseCase: GetSessionUseCase,
    private listSessionsUseCase: ListSessionsUseCase,
  ) {}

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = GetSessionInputSchema.parse({ sessionId: req.params.id });
      const session = await this.getSessionUseCase.execute(validated.sessionId);
      res.json(session);
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
      const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
      const query: { studentId?: string; activeOnly?: boolean } = { studentId };
      if (req.query.activeOnly !== undefined) {
        const val = Array.isArray(req.query.activeOnly)
          ? req.query.activeOnly[0]
          : req.query.activeOnly;
        query.activeOnly = val === 'true';
      }

      const validated = ListSessionsInputSchema.parse(query);
      const sessions = await this.listSessionsUseCase.execute(
        validated.studentId,
        validated.activeOnly,
      );
      res.json(sessions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }
}

export function createSessionsRouter(controller: SessionsController): Router {
  const router = Router();
  router.get('/:id', controller.get.bind(controller));
  router.get('/', controller.list.bind(controller));
  return router;
}
