import type { Request, Response, NextFunction } from 'express';

import { config } from '@/shared/config/index.js';
import type { VerifyTokenUseCase } from '@/features/auth/application/use-cases/verify-token.use-case.js';
import {
  TokenInvalidError,
  TokenExpiredError,
  UserNotFoundError,
} from '@/features/auth/domain/auth.errors.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    username?: string;
    name?: string;
    age?: number;
    quota?: number;
  };
}

export function authMiddleware(verifyTokenUseCase: VerifyTokenUseCase) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token: string | null = null;
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else if (
        req.query.token &&
        typeof req.query.token === 'string' &&
        config.NODE_ENV !== 'production'
      ) {
        // Query param tokens are insecure (logged in URLs, browser history)
        // Only allowed in non-production for SSE streaming workarounds
        token = req.query.token;
      }

      if (!token) {
        res
          .status(401)
          .json({ error: 'No se proporcionó token de autenticación', code: 'TOKEN_MISSING' });
        return;
      }

      const { user } = await verifyTokenUseCase.execute(token);

      req.user = user;
      next();
    } catch (error) {
      if (error instanceof TokenInvalidError) {
        res.status(401).json({ error: 'Token inválido', code: 'TOKEN_INVALID' });
        return;
      }
      if (error instanceof TokenExpiredError) {
        res.status(401).json({ error: 'La sesión ha expirado', code: 'TOKEN_EXPIRED' });
        return;
      }
      if (error instanceof UserNotFoundError) {
        res.status(401).json({ error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
        return;
      }
      next(error);
    }
  };
}

// Role-based authorization middleware factory
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'No autenticado', code: 'NOT_AUTHENTICATED' });
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
