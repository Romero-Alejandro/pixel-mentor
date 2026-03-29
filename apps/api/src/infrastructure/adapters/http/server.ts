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
import { createAdminRouter } from './routes/admin.js';
import { createTTSRouter } from './routes/tts.js';
import { healthRouter } from './routes/health.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { timeoutMiddleware } from './middleware/timeout.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { authMiddleware, requireRole } from './middleware/auth.js';
import { createGamificationRouter } from './routes/gamification.js';
import { createGamificationEventsRouter } from './routes/gamification-events.js';
import { createClassRouter, type ClassRouterDependencies } from './routes/classes.js';
import type { IClassLessonRepository } from '@/domain/repositories/class.repository.js';
import type { StartRecipeUseCase } from '@/application/use-cases/recipe/start-recipe.use-case.js';
import {
  createClassAIRouter,
  createClassAISuggestionsRouter,
  type ClassAIRouterDependencies,
} from './routes/class-ai.js';
import { createRecipeAIRouter } from './routes/recipe-ai.js';
import {
  createClassTemplateRouter,
  type ClassTemplateRouterDependencies,
} from './routes/class-templates.js';

import { createMetricsRouter } from '@/monitoring/routes/eval-metrics.route.js';
import type { LevelService } from '@/game-engine/level.service.js';
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
import type { AdminUserService } from '@/application/services/admin-user.service.js';
import type { RecipeService } from '@/application/services/recipe.service.js';
import type { RecipeAIService } from '@/application/services/recipe-ai.service.js';
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
  adminUserService: AdminUserService;
  questionAnsweringUseCase: QuestionAnsweringUseCase;
  ttsService: TTSService;
  // Class services
  classService: ClassRouterDependencies['classService'];
  classAIService: ClassAIRouterDependencies['classAIService'];
  classTemplateService: ClassTemplateRouterDependencies['classTemplateService'];
  // Class repositories & use cases for demo endpoint
  classLessonRepository: IClassLessonRepository;
  startRecipeUseCase: StartRecipeUseCase;
  // Recipe Services
  recipeService: RecipeService;
  recipeAIService: RecipeAIService;
  // Gamification
  gameEngine: GameEngineCore;
  userGamificationRepository: IUserGamificationRepository;
  badgeRepository: IBadgeRepository;
  levelService: LevelService;
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
    adminUserService,
    questionAnsweringUseCase,
    ttsService,
    gameEngine,
    userGamificationRepository,
    badgeRepository,
    levelService,
    classService,
    classAIService,
    classTemplateService,
    classLessonRepository,
    startRecipeUseCase,
    recipeService,
    recipeAIService,
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
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  // Auth routes (rate limited, public endpoints)
  const protectedMiddleware = authMiddleware(userRepository, verifyTokenUseCase);
  app.use(
    '/api/auth',
    authLimiter,
    createAuthRouter(userRepository, registerUseCase, loginUseCase, protectedMiddleware),
  );

  app.use('/api/recipe', recipeLimiter);
  app.use('/api/recipes', readOnlyLimiter);
  app.use('/api/sessions', readOnlyLimiter);

  app.use(requestLoggerMiddleware(logger));

  // Health check routes (public, no rate limiting)
  app.use('/health', healthRouter);

  // @ts-expect-error - Express 5 compatibility
  app.get('/api', (_req: AppRequest, res: Response) => {
    res.json({
      name: 'Pixel Mentor API',
      version: '1.0.0',
      status: 'running',
    });
  });

  // Protected routes (require auth)
  app.use(
    '/api/recipe',
    protectedMiddleware,
    createRecipeRouter(orchestrateUseCase, questionAnsweringUseCase),
  );
  app.use(
    '/api/recipes',
    protectedMiddleware,
    createRecipesRouter({
      getRecipeUseCase,
      listRecipesUseCase,
      recipeService,
    }),
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
      levelService,
      getSessionUseCase,
      getRecipeUseCase,
      prisma,
    ),
  );

  // Gamification SSE events stream (protected, requires auth)
  app.use('/api/gamification', protectedMiddleware, createGamificationEventsRouter(logger));

  // Class routes (protected, requires TEACHER or ADMIN role)
  const classMiddleware = [protectedMiddleware, requireRole('TEACHER', 'ADMIN')] as const;
  app.use(
    '/api/classes',
    ...classMiddleware,
    createClassRouter({ classService, classLessonRepository, startRecipeUseCase }),
  );
  app.use('/api/classes/ai', ...classMiddleware, createClassAIRouter({ classAIService }));
  app.use(
    '/api/classes/:id/ai',
    ...classMiddleware,
    createClassAISuggestionsRouter({ classAIService }),
  );
  app.use(
    '/api/class-templates',
    ...classMiddleware,
    createClassTemplateRouter({ classTemplateService }),
  );

  // Recipe AI routes (protected, requires TEACHER or ADMIN role)
  app.use('/api/ai', ...classMiddleware, createRecipeAIRouter({ recipeAIService }));

  // Admin routes (protected, requires ADMIN role)
  const adminMiddleware = [protectedMiddleware, requireRole('ADMIN')] as const;
  app.use('/api/admin', ...adminMiddleware, createAdminRouter(adminUserService));

  // Metrics endpoint for evaluation monitoring (public, no auth required)
  app.use('/api/metrics/evaluation', createMetricsRouter());

  // @ts-expect-error - Express 5 compatibility
  app.use((_req: AppRequest, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // @ts-expect-error - Express 5 compatibility
  app.use((err: unknown, req: AppRequest, res: Response, _next: NextFunction) => {
    const requestLogger = req.logger ?? logger;
    requestLogger.error({ url: req.url, method: req.method, err: String(err) });

    // Handle typed AuthError
    if (err instanceof Error && 'httpStatus' in err && 'code' in err) {
      const authErr = err as {
        httpStatus: number;
        code: string;
        message: string;
        details?: unknown;
      };
      res.status(authErr.httpStatus).json({
        error: authErr.message,
        code: authErr.code,
        ...(authErr.details ? { details: authErr.details } : {}),
      });
      return;
    }

    const statusCode = err instanceof Error && 'statusCode' in err ? (err as any).statusCode : 500;
    const message = err instanceof Error ? err.message : 'Error interno del servidor';

    res.status(statusCode).json({ error: message });
  });

  return app;
}
