import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { requireRole } from './auth.middleware.js';
import { clearRefreshTokenCookie, readRefreshToken, setRefreshTokenCookie } from './cookies.js';

import {
  type RegisterUseCase,
  type LoginUseCase,
  type LogoutUseCase,
  type RefreshTokenUseCase,
  type ResolveUserByEmailUseCase,
} from '@/features/auth/application/use-cases/index.js';
import {
  AuthError,
  TokenExpiredError,
  RefreshTokenRevokedError,
} from '@/features/auth/domain/auth.errors.js';

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

const ResolveUserQuerySchema = z.object({
  email: z.string().email('Email inválido'),
});

export class AuthController {
  constructor(
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

      // The refresh token is only delivered via httpOnly cookie.
      setRefreshTokenCookie(res, result.refreshToken);

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
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

      // The refresh token is only delivered via httpOnly cookie.
      setRefreshTokenCookie(res, result.refreshToken);

      res.status(200).json({
        user: result.user,
        accessToken: result.accessToken,
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
      // Public endpoint: revokes the session identified by the refresh token
      // (httpOnly cookie or, for backwards compatibility, the request body).
      const refreshToken = readRefreshToken(req);
      await this.logoutUseCase.execute({ refreshToken });
      clearRefreshTokenCookie(res);
      res.status(204).send();
    } catch (error) {
      // Even if logout fails, we proceed. Client will clear tokens anyway.
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = readRefreshToken(req);

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token requerido', code: 'TOKEN_MISSING' });
        return;
      }

      const result = await this.refreshTokenUseCase.execute({ refreshToken });

      setRefreshTokenCookie(res, result.refreshToken);

      res.status(200).json({
        accessToken: result.accessToken,
      });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        clearRefreshTokenCookie(res);
        res.status(401).json({ error: 'La sesión ha expirado', code: 'TOKEN_EXPIRED' });
        return;
      }
      if (error instanceof RefreshTokenRevokedError) {
        clearRefreshTokenCookie(res);
        res.status(401).json({ error: 'La sesión ya fue cerrada', code: 'TOKEN_REVOKED' });
        return;
      }
      if (error instanceof AuthError) {
        clearRefreshTokenCookie(res);
        res.status(401).json({ error: 'Sesión inválida', code: 'TOKEN_INVALID' });
        return;
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
          username?: string;
          name?: string;
          age?: number;
          quota?: number;
        };
      };

      if (!authReq.user) {
        res.status(401).json({ error: 'No autenticado', code: 'NOT_AUTHENTICATED' });
        return;
      }

      // Must satisfy the shared UserSchema (name and quota are required).
      // Missing fields would make the client's parse throw and look like a
      // dead session on every page reload.
      res.json({
        user: {
          id: authReq.user.id,
          email: authReq.user.email,
          role: authReq.user.role,
          ...(authReq.user.username !== undefined ? { username: authReq.user.username } : {}),
          name: authReq.user.name ?? '',
          ...(authReq.user.age !== undefined ? { age: authReq.user.age } : {}),
          quota: authReq.user.quota ?? 0,
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
  registerUseCase: RegisterUseCase,
  loginUseCase: LoginUseCase,
  logoutUseCase: LogoutUseCase,
  refreshTokenUseCase: RefreshTokenUseCase,
  resolveUserByEmailUseCase: ResolveUserByEmailUseCase,
  protectedMiddleware: (req: Request, res: Response, next: NextFunction) => void,
) {
  const controller = new AuthController(
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
