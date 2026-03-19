import crypto from 'node:crypto';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type pino from 'pino';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case.js';
import type { AppRequest } from '@/types/express';

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

export function authMiddleware(
  userRepository: UserRepository,
  verifyTokenUseCase: VerifyTokenUseCase,
) {
  return async (req: AppRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token: string | null = null;
      const authHeader = req.headers.authorization;

      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else if (typeof req.query.token === 'string') {
        token = req.query.token;
      }

      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const payload = await verifyTokenUseCase.execute(token);
      const user = await userRepository.findById(payload.userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error: unknown) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      next(error);
    }
  };
}
