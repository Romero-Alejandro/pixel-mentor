import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case.js';
import { TokenInvalidError, TokenExpiredError } from '@/domain/ports/auth-errors.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function authMiddleware(userRepo: UserRepository, verifyTokenUseCase: VerifyTokenUseCase) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token: string | null = null;
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else if (req.query.token && typeof req.query.token === 'string') {
        token = req.query.token;
      }

      if (!token) {
        res
          .status(401)
          .json({ error: 'No se proporcionó token de autenticación', code: 'TOKEN_MISSING' });
        return;
      }

      const payload = await verifyTokenUseCase.execute(token);

      const user = await userRepo.findById(payload.userId);
      if (!user) {
        res.status(401).json({ error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      next();
    } catch (error) {
      if (error instanceof TokenInvalidError || error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Token inválido', code: 'TOKEN_INVALID' });
        return;
      }
      if (error instanceof TokenExpiredError || error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'La sesión ha expirado', code: 'TOKEN_EXPIRED' });
        return;
      }
      next(error);
    }
  };
}

// Role-based authorization middleware factory
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado', code: 'NOT_AUTHENTICATED' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
