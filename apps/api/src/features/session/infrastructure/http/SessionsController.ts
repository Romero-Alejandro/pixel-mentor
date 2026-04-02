import type { Response, NextFunction } from 'express';
import { z } from 'zod';

import type { GetSessionUseCase } from '@/features/session/application/use-cases/get-session.use-case';
import type { ListSessionsUseCase } from '@/features/session/application/use-cases/list-sessions.use-case';
import { GetSessionInputSchema, ListSessionsInputSchema } from '@/shared/dto/index';
import type { AppRequest } from '@/shared/types/express.d';

export class SessionsController {
  constructor(
    private readonly getSessionUseCase: GetSessionUseCase,
    private readonly listSessionsUseCase: ListSessionsUseCase,
  ) {}

  get = async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = GetSessionInputSchema.parse({ sessionId: req.params.id });
      const session = await this.getSessionUseCase.execute(validated.sessionId);
      res.json(session);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  };

  list = async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;

      let activeOnly: boolean | undefined;
      if (req.query.activeOnly !== undefined) {
        const val = Array.isArray(req.query.activeOnly)
          ? req.query.activeOnly[0]
          : req.query.activeOnly;
        activeOnly = val === 'true';
      }

      const validated = ListSessionsInputSchema.parse({ studentId, activeOnly });
      const sessions = await this.listSessionsUseCase.execute(
        validated.studentId,
        validated.activeOnly,
      );

      res.json(sessions);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  };
}
