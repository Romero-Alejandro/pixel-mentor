import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type pino from 'pino';

import { createRecipeRouter } from './routes/recipe.js';
import { createRecipesRouter } from './routes/recipes.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createAuthRouter } from './routes/auth.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { timeoutMiddleware } from './middleware/timeout.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';

import type { PrismaClient } from '@/infrastructure/adapters/database/client.js';
import type { OrchestrateRecipeUseCase } from '@/application/use-cases';
import type { GetRecipeUseCase } from '@/application/use-cases/recipe/get-recipe.use-case.js';
import type { ListRecipesUseCase } from '@/application/use-cases/recipe/list-recipes.use-case.js';
import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case.js';
import type { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case.js';
import type { ResetSessionUseCase } from '@/application/use-cases/session/reset-session.use-case.js';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { RegisterUseCase } from '@/application/use-cases/auth/register.use-case.js';
import type { LoginUseCase } from '@/application/use-cases/auth/login.use-case.js';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case.js';

export interface ServerDependencies {
  config: {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: number;
    CORS_ORIGIN: string;
    LOG_LEVEL: pino.Level;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX: number;
    RATE_LIMIT_MAX_INTERACT: number;
    REQUEST_TIMEOUT_MS: number;
    JWT_SECRET: string;
  };
  logger: pino.Logger;
  prisma: PrismaClient;
  userRepo: UserRepository;
  orchestrateUseCase: OrchestrateRecipeUseCase;
  getRecipeUseCase: GetRecipeUseCase;
  listRecipesUseCase: ListRecipesUseCase;
  getSessionUseCase: GetSessionUseCase;
  listSessionsUseCase: ListSessionsUseCase;
  resetSessionUseCase: ResetSessionUseCase;
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  verifyTokenUseCase: VerifyTokenUseCase;
}

export function createApp(deps: ServerDependencies): Express {
  const {
    config,
    logger,
    prisma,
    userRepo,
    orchestrateUseCase,
    getRecipeUseCase,
    listRecipesUseCase,
    getSessionUseCase,
    listSessionsUseCase,
    resetSessionUseCase,
    registerUseCase,
    loginUseCase,
    verifyTokenUseCase,
  } = deps;
  const app = express();

  app.use(requestIdMiddleware);
  app.use(timeoutMiddleware(config.REQUEST_TIMEOUT_MS));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          connectSrc: ["'self'"],
          fontSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'same-origin' },
    }),
  );

  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  const generalLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', generalLimiter);

  const interactLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_INTERACT,
    message: { error: 'Too many interaction requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/leccion/interact', interactLimiter);

  app.use(requestLoggerMiddleware(logger));

  app.get('/health', async (req: Request, res: Response) => {
    const requestLogger = (req as any).logger ?? logger;
    const health: Record<string, unknown> = { status: 'ok', timestamp: new Date().toISOString() };

    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = 'healthy';
    } catch (dbError) {
      requestLogger.error(dbError, 'Health check database failure');
      health.database = 'unhealthy';
      health.status = 'error';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      name: 'Pixel Mentor API',
      version: '1.0.0',
      status: 'running',
    });
  });

  // Auth routes (no authentication required)
  app.use(
    '/api/auth',
    createAuthRouter(userRepo, registerUseCase, loginUseCase, verifyTokenUseCase),
  );

  const protectedMiddleware = authMiddleware(userRepo, verifyTokenUseCase);

  // Protected routes
  app.use('/api/recipe', protectedMiddleware, createRecipeRouter(orchestrateUseCase));
  app.use(
    '/api/recipes',
    protectedMiddleware,
    createRecipesRouter(getRecipeUseCase, listRecipesUseCase),
  );
  app.use(
    '/api/sessions',
    protectedMiddleware,
    createSessionsRouter(getSessionUseCase, listSessionsUseCase, resetSessionUseCase),
  );

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestLogger = (_req as any).logger ?? logger;
    requestLogger.error(err, { url: _req.url, method: _req.method });
    const statusCode = (err as any).statusCode ?? 500;
    const message = (err as any).message ?? 'Internal Server Error';
    res.status(statusCode).json({ error: message });
  });

  return app;
}
