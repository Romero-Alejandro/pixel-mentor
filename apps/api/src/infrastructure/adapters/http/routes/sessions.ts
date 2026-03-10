import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case';
import type { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case';
import { GetSessionInputSchema, ListSessionsInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createSessionsRouter(
  getSessionUseCase: GetSessionUseCase,
  listSessionsUseCase: ListSessionsUseCase,
): Router {
  const router = Router();

  router.get(
    '/:id',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const validated = GetSessionInputSchema.parse({ sessionId: request.params.id });

        const session = await getSessionUseCase.execute(validated.sessionId);

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
        const studentId =
          typeof request.query.studentId === 'string' ? request.query.studentId : undefined;
        const query: { studentId?: string; activeOnly?: boolean } = { studentId };
        if (request.query.activeOnly !== undefined) {
          const val = Array.isArray(request.query.activeOnly)
            ? request.query.activeOnly[0]
            : request.query.activeOnly;
          query.activeOnly = val === 'true';
        }

        const validated = ListSessionsInputSchema.parse(query);

        const sessions = await listSessionsUseCase.execute(
          validated.studentId,
          validated.activeOnly,
        );

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

  return router;
}
