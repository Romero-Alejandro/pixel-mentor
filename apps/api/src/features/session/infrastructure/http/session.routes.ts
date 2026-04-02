import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '@/features/auth/infrastructure/http/auth.middleware';
// Re-export use cases from original location for backward compatibility
import { GetSessionUseCase } from '@/features/session/application/use-cases/get-session.use-case';
import { ListSessionsUseCase } from '@/features/session/application/use-cases/list-sessions.use-case';
import { ResetSessionUseCase } from '@/features/session/application/use-cases/reset-session.use-case';
import { CompleteSessionUseCase } from '@/features/session/application/use-cases/complete-session.use-case';

export interface AppRequest extends AuthRequest {}

const SessionParamsSchema = z.object({
  sessionId: z.string(),
});

export function createSessionRouter(
  getSessionUseCase: GetSessionUseCase,
  listSessionsUseCase: ListSessionsUseCase,
  resetSessionUseCase: ResetSessionUseCase,
  completeSessionUseCase: CompleteSessionUseCase,
): Router {
  const router = Router();

  router.get(
    '/:sessionId',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const params = SessionParamsSchema.parse(request.params);
        const session = await getSessionUseCase.execute(params.sessionId);
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
        const appRequest = request as AppRequest;
        const userId = appRequest.user?.id;
        const activeOnly = request.query.active === 'true';

        if (!userId) {
          response.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const sessions = await listSessionsUseCase.execute(userId, activeOnly);
        response.json(sessions);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/:sessionId/reset',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const params = SessionParamsSchema.parse(request.params);
        const result = await resetSessionUseCase.execute(params.sessionId);
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
    '/:sessionId/complete',
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const params = SessionParamsSchema.parse(request.params);
        const result = await completeSessionUseCase.execute(params.sessionId);
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

  return router;
}
