import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { UserRepository } from '@/domain/ports/user-repository.js';
import type {
  RegisterUseCase,
  LoginUseCase,
  VerifyTokenUseCase,
} from '@/application/use-cases/auth/index.js';

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).default('STUDENT'),
  age: z.number().int().positive().optional(),
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  constructor(
    private userRepo: UserRepository,
    private registerUseCase: RegisterUseCase,
    private loginUseCase: LoginUseCase,
    private verifyTokenUseCase: VerifyTokenUseCase,
  ) {}

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RegisterBodySchema.parse(req.body);

      const result = await this.registerUseCase.execute({
        email: validated.email,
        password: validated.password,
        name: validated.name,
        role: validated.role,
        age: validated.age,
      });

      res.status(201).json({
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = LoginBodySchema.parse(req.body);

      const result = await this.loginUseCase.execute({
        email: validated.email,
        password: validated.password,
      });

      res.status(200).json({
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.issues });
        return;
      }
      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.slice(7);
      const payload = await this.verifyTokenUseCase.execute(token);

      // Fetch full user (without passwordHash)
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message;
        if (message === 'Token expired') {
          res.status(401).json({ error: 'Token expired' });
          return;
        }
        if (message === 'Invalid token') {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
      }
      next(error);
    }
  }
}

export function createAuthRouter(
  userRepo: UserRepository,
  registerUseCase: RegisterUseCase,
  loginUseCase: LoginUseCase,
  verifyTokenUseCase: VerifyTokenUseCase,
) {
  const controller = new AuthController(
    userRepo,
    registerUseCase,
    loginUseCase,
    verifyTokenUseCase,
  );

  const router = Router();

  router.post('/register', (req: Request, res: Response, next: NextFunction) =>
    controller.register(req, res, next),
  );
  router.post('/login', (req: Request, res: Response, next: NextFunction) =>
    controller.login(req, res, next),
  );
  router.get('/me', (req: Request, res: Response, next: NextFunction) =>
    controller.me(req, res, next),
  );

  return router;
}
