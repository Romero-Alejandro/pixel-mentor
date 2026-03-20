import type { Express, Response, NextFunction } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type pino from 'pino';

import { createRecipeRouter } from './routes/recipe.js';
import { createRecipesRouter } from './routes/recipes.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createAuthRouter } from './routes/auth.js';
import { createTTSRouter } from './routes/tts.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { timeoutMiddleware } from './middleware/timeout.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';

import { createMetricsRouter } from '@/monitoring/routes/eval-metrics.route.js';
import { createGamificationRouter } from './routes/gamification.js';
import { createGamificationEventsRouter } from './routes/gamification-events.js';
import type { GameEngineCore } from '@/game-engine/core';
import type {
  IUserGamificationRepository,
  IBadgeRepository,
} from '@/domain/ports/gamification-ports';
import type { AppRequest } from '@/types/express.js';
import type { PrismaClient } from '@/infrastructure/adapters/database/client.js';
import type { OrchestrateRecipeUseCase } from '@/application/use-cases';
import type { GetRecipeUseCase } from '@/application/use-cases/recipe/get-recipe.use-case.js';
import type { ListRecipesUseCase } from '@/application/use-cases/recipe/list-recipes.use-case.js';
import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case.js';
import type { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case.js';
import type { ResetSessionUseCase } from '@/application/use-cases/session/reset-session.use-case.js';
import type { CompleteSessionUseCase } from '@/application/use-cases/session/complete-session.use-case.js';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { RegisterUseCase } from '@/application/use-cases/auth/register.use-case.js';
import type { LoginUseCase } from '@/application/use-cases/auth/login.use-case.js';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case.js';
import type { QuestionAnsweringUseCase } from '@/application/use-cases/question/question-answering.use-case.js';
import type { TTSService } from '@/domain/ports/tts-service.js';

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
  userRepository: UserRepository; // Updated to match dependency container
  orchestrateUseCase: OrchestrateRecipeUseCase;
  getRecipeUseCase: GetRecipeUseCase;
  listRecipesUseCase: ListRecipesUseCase;
  getSessionUseCase: GetSessionUseCase;
  listSessionsUseCase: ListSessionsUseCase;
  resetSessionUseCase: ResetSessionUseCase;
  completeSessionUseCase: CompleteSessionUseCase;
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  verifyTokenUseCase: VerifyTokenUseCase;
  questionAnsweringUseCase: QuestionAnsweringUseCase;
  ttsService: TTSService;
  // Gamification
  gameEngine: GameEngineCore;
  userGamificationRepository: IUserGamificationRepository;
  badgeRepository: IBadgeRepository;
}

export function createApp(deps: ServerDependencies): Express {
  const {
    config,
    logger,
    prisma,
    userRepository, // Updated name
    orchestrateUseCase,
    getRecipeUseCase,
    listRecipesUseCase,
    getSessionUseCase,
    listSessionsUseCase,
    resetSessionUseCase,
    completeSessionUseCase,
    registerUseCase,
    loginUseCase,
    verifyTokenUseCase,
    questionAnsweringUseCase,
    ttsService,
    gameEngine,
    userGamificationRepository,
    badgeRepository,
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

  const corsOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());

  app.use(
    cors({
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  const authLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX * 2,
    message: { error: 'Too many authentication requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const recipeLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX * 5,
    message: { error: 'Too many recipe requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const readOnlyLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX * 10,
    message: { error: 'Too many read requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const ttsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: { error: 'Demasiadas solicitudes de voz. Intenta de nuevo en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth', authLimiter);
  app.use('/api/recipe', recipeLimiter);
  app.use('/api/recipes', readOnlyLimiter);
  app.use('/api/sessions', readOnlyLimiter);

  app.use(requestLoggerMiddleware(logger));

  app.get('/health', async (req: AppRequest, res: Response) => {
    const requestLogger = req.logger ?? logger;
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

  app.get('/api', (_req: AppRequest, res: Response) => {
    res.json({
      name: 'Pixel Mentor API',
      version: '1.0.0',
      status: 'running',
    });
  });

  app.use(
    '/api/auth',
    createAuthRouter(userRepository, registerUseCase, loginUseCase, verifyTokenUseCase),
  );

  const protectedMiddleware = authMiddleware(userRepository, verifyTokenUseCase);

  app.use(
    '/api/recipe',
    protectedMiddleware,
    createRecipeRouter(orchestrateUseCase, questionAnsweringUseCase),
  );
  app.use(
    '/api/recipes',
    protectedMiddleware,
    createRecipesRouter(getRecipeUseCase, listRecipesUseCase),
  );
  app.use(
    '/api/sessions',
    protectedMiddleware,
    createSessionsRouter(
      getSessionUseCase,
      listSessionsUseCase,
      resetSessionUseCase,
      completeSessionUseCase,
    ),
  );

  app.use('/api/tts', ttsLimiter, protectedMiddleware, createTTSRouter(ttsService));

  // Gamification routes (protected, requires auth)
  app.use(
    '/api/gamification',
    protectedMiddleware,
    createGamificationRouter(
      gameEngine,
      userGamificationRepository,
      badgeRepository,
      getSessionUseCase,
      getRecipeUseCase,
      prisma,
    ),
  );

  // Gamification SSE events stream (protected, requires auth)
  app.use('/api/gamification', protectedMiddleware, createGamificationEventsRouter(logger));

  // Metrics endpoint for evaluation monitoring (public, no auth required)
  app.use('/api/metrics/evaluation', createMetricsRouter());

  app.use((_req: AppRequest, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, req: AppRequest, res: Response, _next: NextFunction) => {
    const requestLogger = req.logger ?? logger;
    requestLogger.error(err, { url: req.url, method: req.method });

    const statusCode = err instanceof Error && 'statusCode' in err ? (err as any).statusCode : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';

    res.status(statusCode).json({ error: message });
  });

  return app;
}
