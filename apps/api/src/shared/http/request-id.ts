import crypto from 'node:crypto';

import type { Request, Response, NextFunction } from 'express';
import type { AppRequest } from '@/shared/types/express.d';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  (req as AppRequest).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
