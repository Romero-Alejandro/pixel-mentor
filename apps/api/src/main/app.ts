import type { Express, Response, NextFunction } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type pino from 'pino';

// Feature-based routers from original location (not yet migrated to features)
import { createAuthRouter } from '@/features/auth/infrastructure/http/auth.routes.js';
import {
  authMiddleware,
  requireRole,
} from '@/features/auth/infrastructure/http/auth.middleware.js';
import { createRecipeRouter } from '@/features/recipe/infrastructure/http/recipe.routes.js';
import { createRecipesRouter } from '@/features/recipe/infrastructure/http/recipes.routes.js';
import { createSessionsRouter } from '@/features/session/infrastructure/http/sessions.routes.js';
import { createTTSRouter } from '@/features/tts/infrastructure/http/tts.routes.js';
import { createGamificationRouter } from '@/features/gamification/infrastructure/http/gamification.routes.js';
import { createGamificationEventsRouter } from '@/features/gamification/infrastructure/http/gamification-events.routes.js';
import { createClassRouter } from '@/features/class/infrastructure/http/classes.routes.js';
import {
  createClassAIRouter,
  createClassAISuggestionsRouter,
} from '@/features/class/infrastructure/http/class-ai.routes.js';
import { createClassTemplateRouter } from '@/features/class/infrastructure/http/class-templates.routes.js';
import { createAdminRouter } from '@/shared/http/admin.routes.js';
import { createLLMGovernanceRouter } from '@/shared/http/llm-governance.routes.js';

// Health and metrics
import { healthRouter } from '@/shared/http/health.routes.js';
import { createMetricsRouter } from '@/shared/monitoring/routes/eval-metrics.route.js';

// Database
import { prisma } from '@/database/client.js';

// Middleware
import { requestIdMiddleware } from '@/shared/http/request-id.js';
import { timeoutMiddleware } from '@/shared/http/timeout.js';
import { requestLoggerMiddleware } from '@/shared/http/index.js';

// Types
import type { AppRequest } from '@/shared/types/express.d.js';
import type { Config } from '@/shared/config/index.js';
import type { AuthContainer } from '@/features/auth/infrastructure/di/auth.container.js';

export interface AppDependencies {
  config: Config;
  logger: pino.Logger;
  auth: AuthContainer;
  recipe: any; // Using 'any' to bypass type conflicts between feature and old use cases
  session: any; // Using 'any' to bypass type conflicts between feature and old use cases
  gamification: any; // Using 'any' to bypass type conflicts between feature and old services
  class: any; // Using 'any' to bypass type conflicts between feature and old services
  tts: any; // Using 'any' to bypass type conflicts
}

export function createApp(deps: AppDependencies): Express {
  const { config, logger, auth, recipe, session, gamification, class: classContainer, tts } = deps;

  const app = express();

  // Core middleware
  app.use(requestIdMiddleware);
  app.use(timeoutMiddleware(config.REQUEST_TIMEOUT_MS));

  // Security middleware
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

  // CORS
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

  // Rate limiters
  const authLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX * 2,
    message: { error: 'Too many authentication requests' },
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

  // Protected middleware setup
  const protectedMiddleware = authMiddleware(auth.userRepository, auth.verifyTokenUseCase);

  // Auth routes (rate limited, public endpoints)
  app.use(
    '/api/auth',
    authLimiter,
    createAuthRouter(
      auth.userRepository,
      auth.registerUseCase,
      auth.loginUseCase,
      auth.refreshTokenUseCase,
      protectedMiddleware,
    ),
  );

  // Public read-only routes
  app.use('/api/recipes', readOnlyLimiter);
  app.use('/api/sessions', readOnlyLimiter);

  // Request logging
  // @ts-expect-error - Express 5 compatibility with middleware function
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
  // Get the global orchestrate use case that was set up in index.ts
  const orchestrateUseCase = (globalThis as any).__orchestrateUseCase;
  const questionAnsweringUseCase = (globalThis as any).__questionAnsweringUseCase;

  // Recipe routes
  app.use(
    '/api/recipe',
    protectedMiddleware,
    createRecipeRouter(orchestrateUseCase, questionAnsweringUseCase),
  );
  app.use(
    '/api/recipes',
    protectedMiddleware,
    createRecipesRouter({
      getRecipeUseCase: recipe.getRecipeUseCase,
      listRecipesUseCase: recipe.listRecipesUseCase,
      recipeService: recipe.recipeService,
    }),
  );
  app.use(
    '/api/sessions',
    protectedMiddleware,
    createSessionsRouter(
      session.getSessionUseCase,
      session.listSessionsUseCase,
      session.resetSessionUseCase,
      session.completeSessionUseCase,
    ),
  );

  // TTS routes
  app.use('/api/tts', ttsLimiter, protectedMiddleware, createTTSRouter(tts.ttsService));

  // Gamification routes (protected, requires auth)
  app.use(
    '/api/gamification',
    protectedMiddleware,
    createGamificationRouter(
      gamification.gameEngine,
      gamification.userGamificationRepository,
      gamification.badgeRepository,
      gamification.badgeEngine,
      gamification.levelService,
      session.getSessionUseCase,
      recipe.getRecipeUseCase,
      prisma,
    ),
  );

  // Gamification SSE events stream (protected, requires auth)
  app.use('/api/gamification', protectedMiddleware, createGamificationEventsRouter(logger));

  // Class routes (protected, requires TEACHER or ADMIN role)
  const classMiddleware = [protectedMiddleware, requireRole('TEACHER', 'ADMIN')] as const;

  // Get start recipe use case from global
  const startRecipeUseCase = (globalThis as any).__startRecipeUseCase;

  app.use(
    '/api/classes',
    ...classMiddleware,
    createClassRouter({
      classService: classContainer.classService,
      classLessonRepository: classContainer.classLessonRepository,
      startRecipeUseCase,
    }),
  );
  app.use(
    '/api/classes/ai',
    ...classMiddleware,
    createClassAIRouter({ classAIService: classContainer.classAIService }),
  );
  app.use(
    '/api/classes/:id/ai',
    ...classMiddleware,
    createClassAISuggestionsRouter({ classAIService: classContainer.classAIService }),
  );
  app.use(
    '/api/class-templates',
    ...classMiddleware,
    createClassTemplateRouter({ classTemplateService: classContainer.classTemplateService }),
  );

  // Admin routes (protected, requires ADMIN role)
  const adminMiddleware = [protectedMiddleware, requireRole('ADMIN')] as const;
  app.use('/api/admin', ...adminMiddleware, createAdminRouter(auth.adminUserService));

  // LLM Governance admin routes (protected, requires ADMIN role)
  app.use('/api/admin/llm-governance', ...adminMiddleware, createLLMGovernanceRouter());

  // Metrics endpoint for evaluation monitoring (public, no auth required)
  app.use('/api/metrics/evaluation', createMetricsRouter());

  // 404 handler
  // @ts-expect-error - Express 5 compatibility
  app.use((_req: AppRequest, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
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
