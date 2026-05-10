import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { requireRole } from './auth.middleware.js';

import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import {
  type RegisterUseCase,
  type LoginUseCase,
  type LogoutUseCase,
  type RefreshTokenUseCase,
  type ResolveUserByEmailUseCase,
} from '@/features/auth/application/use-cases/index.js';
import type { AuthError } from '@/features/auth/domain/auth.errors.js';

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
  username: z.string().min(3).max(30).optional(),
});

const LoginBodySchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const RefreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const LogoutBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const ResolveUserQuerySchema = z.object({
  email: z.string().email('Email inválido'),
});

export class AuthController {
  constructor(
    private userRepo: IUserRepository,
    private registerUseCase: RegisterUseCase,
    private loginUseCase: LoginUseCase,
    private logoutUseCase: LogoutUseCase,
    private refreshTokenUseCase: RefreshTokenUseCase,
    private resolveUserByEmailUseCase: ResolveUserByEmailUseCase,
  ) {}

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RegisterBodySchema.parse(req.body);

      const result = await this.registerUseCase.execute({
        email: validated.email,
        password: validated.password,
        name: validated.name,
        age: validated.age,
        username: validated.username,
      });

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: 'Error de validación', code: 'VALIDATION_ERROR', details: error.issues });
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = LoginBodySchema.parse(req.body);

      const result = await this.loginUseCase.execute({
        identifier: validated.identifier,
        password: validated.password,
      });

      res.status(200).json({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: 'Error de validación', code: 'VALIDATION_ERROR', details: error.issues });
        return;
      }
      if (
        error instanceof Error &&
        'code' in error &&
        (error as AuthError).code === 'INVALID_CREDENTIALS'
      ) {
        res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
        return;
      }
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = LogoutBodySchema.parse(req.body);
      await this.logoutUseCase.execute({ refreshToken: validated.refreshToken });
      res.status(204).send();
    } catch (error) {
      // Even if logout fails, we proceed. Client will clear tokens anyway.
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: 'Bad Request', code: 'VALIDATION_ERROR', details: error.issues });
        return;
      }
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RefreshTokenBodySchema.parse(req.body);

      const result = await this.refreshTokenUseCase.execute({
        refreshToken: validated.refreshToken,
      });

      res.status(200).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: 'Error de validación', code: 'VALIDATION_ERROR', details: error.issues });
        return;
      }
      if (error instanceof Error) {
        if (
          error.message.includes('revoked') ||
          error.message.includes('expired') ||
          error.message.includes('Invalid')
        ) {
          res.status(401).json({
            error: error.message,
            code: 'TOKEN_INVALID',
          });
          return;
        }
      }
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as Request & {
        user?: {
          id: string;
          email: string;
          role: string;
        };
      };

      if (!authReq.user) {
        res.status(401).json({ error: 'No autenticado', code: 'NOT_AUTHENTICATED' });
        return;
      }

      // User data already loaded by authMiddleware via VerifyTokenUseCase
      res.json({
        user: {
          id: authReq.user.id,
          email: authReq.user.email,
          role: authReq.user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async resolveByEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = ResolveUserQuerySchema.parse(req.query);

      const result = await this.resolveUserByEmailUseCase.execute({
        email: validated.email,
      });

      if (!result) {
        res.status(404).json({ error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
        return;
      }

      res.json({ uuid: result.uuid, email: result.email, name: result.name });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: 'Error de validación', code: 'VALIDATION_ERROR', details: error.issues });
        return;
      }
      next(error);
    }
  }
}

export function createAuthRouter(
  userRepo: IUserRepository,
  registerUseCase: RegisterUseCase,
  loginUseCase: LoginUseCase,
  logoutUseCase: LogoutUseCase,
  refreshTokenUseCase: RefreshTokenUseCase,
  resolveUserByEmailUseCase: ResolveUserByEmailUseCase,
  protectedMiddleware: (req: Request, res: Response, next: NextFunction) => void,
) {
  const controller = new AuthController(
    userRepo,
    registerUseCase,
    loginUseCase,
    logoutUseCase,
    refreshTokenUseCase,
    resolveUserByEmailUseCase,
  );

  const router = Router();

  router.post('/register', (req: Request, res: Response, next: NextFunction) =>
    controller.register(req, res, next),
  );
  router.post('/login', (req: Request, res: Response, next: NextFunction) =>
    controller.login(req, res, next),
  );
  router.post('/refresh', (req: Request, res: Response, next: NextFunction) =>
    controller.refresh(req, res, next),
  );
  router.post('/logout', (req: Request, res: Response, next: NextFunction) =>
    controller.logout(req, res, next),
  );

  router.get('/me', protectedMiddleware, (req: Request, res: Response, next: NextFunction) =>
    controller.me(req, res, next),
  );

  router.get(
    '/users/resolve',
    protectedMiddleware,
    requireRole('TEACHER'),
    (req: Request, res: Response, next: NextFunction) => controller.resolveByEmail(req, res, next),
  );

  return router;
}
