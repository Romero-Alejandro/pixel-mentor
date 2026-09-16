import crypto from 'node:crypto';

import type { Response, NextFunction } from 'express';
import type pino from 'pino';

import type { AppRequest } from '@/shared/types/express.d';

export function requestIdMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function requestLoggerMiddleware(logger: pino.Logger) {
  return (req: AppRequest, res: Response, next: NextFunction): void => {
    req.logger = logger.child({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    req.startTime = Date.now();

    res.on('finish', () => {
      req.logger.info({
        statusCode: res.statusCode,
        responseTime: Date.now() - req.startTime,
      });
    });

    next();
  };
}

export function timeoutMiddleware(timeoutMs: number) {
  return (_req: AppRequest, res: Response, next: NextFunction): void => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(504).json({ error: 'Request timeout' });
      } else {
        res.destroy();
      }
    });
    next();
  };
}
