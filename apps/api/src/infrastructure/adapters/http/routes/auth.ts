import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import { z } from 'zod';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { RegisterUseCase, LoginUseCase } from '@/application/use-cases/auth/index.js';
import type { AuthError } from '@/domain/ports/auth-errors.js';

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
  username: z.string().min(3).max(30).optional(),
});

const LoginBodySchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export class AuthController {
  constructor(
    private userRepo: UserRepository,
    private registerUseCase: RegisterUseCase,
    private loginUseCase: LoginUseCase,
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
        token: result.token,
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
        token: result.token,
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

      const user = await this.userRepo.findById(authReq.user.id);
      if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
        return;
      }

      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
}

export function createAuthRouter(
  userRepo: UserRepository,
  registerUseCase: RegisterUseCase,
  loginUseCase: LoginUseCase,
  protectedMiddleware: RequestHandler,
) {
  const controller = new AuthController(userRepo, registerUseCase, loginUseCase);

  const router = Router();

  // Public routes - no auth required
  router.post('/register', (req: Request, res: Response, next: NextFunction) =>
    controller.register(req, res, next),
  );
  router.post('/login', (req: Request, res: Response, next: NextFunction) =>
    controller.login(req, res, next),
  );

  // Protected route - auth required
  router.get('/me', protectedMiddleware, (req: Request, res: Response, next: NextFunction) =>
    controller.me(req, res, next),
  );

  return router;
}
