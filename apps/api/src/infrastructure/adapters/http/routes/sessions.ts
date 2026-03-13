import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case';
import type { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case';
import type { ResetSessionUseCase } from '@/application/use-cases/session/reset-session.use-case';
import { GetSessionInputSchema, ListSessionsInputSchema } from '@/application/dto';

export interface AppRequest extends Request {
  logger?: pino.Logger;
  requestId?: string;
  startTime?: number;
}

export function createSessionsRouter(
  getSessionUseCase: GetSessionUseCase,
  listSessionsUseCase: ListSessionsUseCase,
  resetSessionUseCase: ResetSessionUseCase,
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
        const sessionId = request.params.id as string;
        const result = await resetSessionUseCase.execute(sessionId);
        response.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
