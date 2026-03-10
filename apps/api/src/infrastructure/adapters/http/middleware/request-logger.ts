import type { Request, Response, NextFunction } from 'express';
import type pino from 'pino';

export function requestLoggerMiddleware(logger: pino.Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestLogger = logger.child({
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    (req as any).logger = requestLogger;
    res.on('finish', () => {
      requestLogger.info({
        statusCode: res.statusCode,
        responseTime: Date.now() - ((req as any).startTime as number),
      });
    });
    (req as any).startTime = Date.now();
    next();
  };
}
