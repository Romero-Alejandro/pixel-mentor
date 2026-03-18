import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case.js';

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
        // Support token in query string (useful for EventSource SSE connections)
        token = req.query.token;
      }

      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const payload = await verifyTokenUseCase.execute(token);

      // Optionally verify user still exists
      const user = await userRepo.findById(payload.userId);
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
    } catch (error) {
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
