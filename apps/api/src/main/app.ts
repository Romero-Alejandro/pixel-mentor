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
import type { LessonCompletionService } from '@/features/recipe/application/services/lesson-completion.service.js';
import { createGamificationRouter } from '@/features/gamification/infrastructure/http/gamification.routes.js';
import { createGamificationEventsRouter } from '@/features/gamification/infrastructure/http/gamification-events.routes.js';
import {
  createClassRouter,
  createClassLessonStudentRouter,
} from '@/features/class/infrastructure/http/classes.routes.js';
import {
  createClassAIRouter,
  createClassAISuggestionsRouter,
} from '@/features/class/infrastructure/http/class-ai.routes.js';
import { createClassTemplateRouter } from '@/features/class/infrastructure/http/class-templates.routes.js';
import { createRecipeAIRouter } from '@/features/recipe/infrastructure/http/recipe-ai.routes.js';
import { createGroupRoutes } from '@/features/group/infrastructure/http/group.routes.js';
import { createContentAccessRoutes } from '@/features/group/infrastructure/http/content-access.routes.js';
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
import type { RecipeContainer } from '@/features/recipe/infrastructure/di/recipe.container.js';
import type { SessionContainer } from '@/features/session/infrastructure/di/session.container.js';
import type { GamificationContainer } from '@/features/gamification/infrastructure/di/gamification.container.js';
import type { ClassContainer } from '@/features/class/infrastructure/di/class.container.js';
import type { TTSContainer } from '@/features/tts/infrastructure/di/tts.container.js';
import type { GroupContainer } from '@/features/group/infrastructure/di/group.container.js';
import type { ClinicalContainer } from '@/features/clinical/infrastructure/di/clinical.container.js';
import type { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case.js';
import type { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case.js';
import { AppError, HttpError } from '@/shared/errors/index.js';
import { moduleLogger } from '@/shared/logger/logger.js';

// Fallback logger for requests that fail before requestLoggerMiddleware ran
const httpLogger = moduleLogger('http');

export interface AppDependencies {
  config: Config;
  logger: pino.Logger;
  auth: AuthContainer;
  recipe: RecipeContainer;
  session: SessionContainer;
  gamification: GamificationContainer;
  class: ClassContainer;
  tts: TTSContainer;
  group: GroupContainer;
  clinical: ClinicalContainer;
  /** Cross-feature orchestration use case, assembled at the composition root (index.ts). */
  orchestrateUseCase: OrchestrateRecipeUseCase;
  /** Recipe start use case shared by session and class routers. */
  startRecipeUseCase: StartRecipeUseCase;
  /** Real-accuracy recomputation for the mission report (composition root wiring). */
  lessonCompletionService: LessonCompletionService;
}

export function createApp(deps: AppDependencies): Express {
  const {
    config,
    logger,
    auth,
    recipe,
    session,
    gamification,
    class: classContainer,
    tts,
    group,
    clinical,
  } = deps;

  const app = express();

  // Trust the reverse proxy (when deployed behind one) so req.ip and the rate
  // limiters key on the real client address instead of the proxy IP. Without
  // this, every client behind the proxy shares one rate-limit bucket and the
  // auth limiter becomes a global lockout. Not set when exposed directly.
  if (config.TRUST_PROXY !== undefined) {
    app.set(
      'trust proxy',
      /^\d+$/.test(config.TRUST_PROXY) ? Number(config.TRUST_PROXY) : config.TRUST_PROXY,
    );
  }

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

  // Additional security headers beyond helmet defaults
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Relies on CSP instead
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // HTTPS enforcement in production
  if (config.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] !== 'https' && !req.secure) {
        res.redirect(301, `https://${req.headers.host}${req.url}`);
        return;
      }
      next();
    });
  }

  // CORS
  const corsOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
      // credentials: true — the refresh token travels in an httpOnly cookie
      // scoped to /api/auth. Explicit origins are enforced above and SameSite=Lax
      // mitigates CSRF on the auth endpoints.
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
  const protectedMiddleware = authMiddleware(auth.verifyTokenUseCase);

  // Auth routes (rate limited, public endpoints)
  app.use(
    '/api/auth',
    authLimiter,
    createAuthRouter(
      auth.registerUseCase,
      auth.loginUseCase,
      auth.logoutUseCase,
      auth.refreshTokenUseCase,
      auth.resolveUserByEmailUseCase,
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
  // Use cases are injected via AppDependencies — no globalThis service locator.
  const orchestrateUseCase = deps.orchestrateUseCase;
  const startRecipeUseCase = deps.startRecipeUseCase;
  const questionAnsweringUseCase = recipe.questionAnsweringUseCase;

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
      createRecipeUseCase: recipe.createRecipeUseCase,
      updateRecipeUseCase: recipe.updateRecipeUseCase,
      deleteRecipeUseCase: recipe.deleteRecipeUseCase,
      addStepUseCase: recipe.addStepUseCase,
      updateStepUseCase: recipe.updateStepUseCase,
      deleteStepUseCase: recipe.deleteStepUseCase,
      reorderStepsUseCase: recipe.reorderStepsUseCase,
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
      startRecipeUseCase,
      group.contentAccessService,
      classContainer.classLessonRepository,
      recipe.getRecipeUseCase,
    ),
  );

  // TTS routes: in E2E mode, skip auth for easier testing
  if (config.E2E_MODE === true) {
    app.use('/api/tts', ttsLimiter, createTTSRouter(tts.ttsService));
  } else {
    app.use('/api/tts', ttsLimiter, protectedMiddleware, createTTSRouter(tts.ttsService));
  }

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
      clinical.clinicalCalculatorService,
      // Real-accuracy recomputation for the mission report — reuses the same
      // ActivityAttemptRepository the completion flow uses.
      deps.lessonCompletionService,
    ),
  );

  // Gamification SSE events stream (protected, requires auth)
  app.use('/api/gamification', protectedMiddleware, createGamificationEventsRouter(logger));

  // Recipe AI routes (protected, requires TEACHER or ADMIN role)
  const aiMiddleware = [protectedMiddleware, requireRole('TEACHER', 'ADMIN')] as const;
  app.use(
    '/api/ai',
    ...aiMiddleware,
    createRecipeAIRouter({ recipeAIService: recipe.recipeAIService }),
  );

  // Group routes (protected, requires TEACHER or ADMIN role) - MUST be before createClassLessonStudentRouter
  const groupMiddleware = [protectedMiddleware, requireRole('TEACHER', 'ADMIN')] as const;
  app.use('/api/groups', ...groupMiddleware, createGroupRoutes(group.groupService));
  app.use(
    '/api/content/accessible',
    protectedMiddleware,
    createContentAccessRoutes(group.contentAccessService),
  );

  // Student-facing class lesson routes (protected, requires auth only)
  app.use(
    '/api/student/classes',
    protectedMiddleware,
    createClassLessonStudentRouter({
      classService: classContainer.classService,
      classLessonRepository: classContainer.classLessonRepository,
      startRecipeUseCase,
      orchestrateUseCase,
      contentAccessService: group.contentAccessService,
    }),
  );

  // Class routes (protected, requires auth - route-level authorization in routes)
  // NOTE: Removed requireRole('TEACHER', 'ADMIN') to allow students to access via checkEnrollment
  const classMiddleware = [protectedMiddleware];

  app.use(
    '/api/classes',
    ...classMiddleware,
    createClassRouter({
      classService: classContainer.classService,
      classLessonRepository: classContainer.classLessonRepository,
      startRecipeUseCase,
      orchestrateUseCase,
      contentAccessService: group.contentAccessService,
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
  app.use('/api/admin', Array.from(adminMiddleware), createAdminRouter(auth.adminUserService));

  // LLM Governance admin routes (protected, requires ADMIN role)
  app.use('/api/admin/llm-governance', Array.from(adminMiddleware), createLLMGovernanceRouter());

  // Metrics endpoint for evaluation monitoring (admin-only: exposes internal
  // evaluation data, and the reset endpoint mutates shared state)
  app.use('/api/metrics/evaluation', ...adminMiddleware, createMetricsRouter());

  // 404 handler
  // @ts-expect-error - Express 5 compatibility
  app.use((_req: AppRequest, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler — logs details internally with pino, never leaks internals to clients
  // @ts-expect-error - Express 5 compatibility
  app.use((err: unknown, req: AppRequest, res: Response, _next: NextFunction) => {
    const requestLogger = req.logger ?? httpLogger;

    // Normalize legacy ad-hoc errors that carry httpStatus/statusCode but are
    // not AppError instances (e.g. GovernanceError, SessionError)
    let error: unknown = err;
    if (!(error instanceof AppError) && typeof error === 'object' && error !== null) {
      const candidate = error as { httpStatus?: unknown; statusCode?: unknown };
      const status =
        typeof candidate.httpStatus === 'number'
          ? candidate.httpStatus
          : typeof candidate.statusCode === 'number'
            ? candidate.statusCode
            : undefined;
      if (status !== undefined) {
        const raw = error as { code?: unknown; message?: unknown };
        error = new HttpError(
          status,
          typeof raw.message === 'string' ? raw.message : 'Request rejected',
          typeof raw.code === 'string' ? raw.code : `HTTP_${status}`,
        );
      }
    }

    if (res.headersSent) {
      requestLogger.error({ err: error, requestId: req.requestId }, 'Error after headers sent');
      res.destroy();
      return;
    }

    if (error instanceof AppError) {
      if (error.httpStatus >= 500) {
        requestLogger.error({ err: error, requestId: req.requestId }, 'Request failed');
      } else {
        requestLogger.warn(
          { code: error.code, requestId: req.requestId },
          `Request rejected: ${error.message}`,
        );
      }
      const response: { error: string; code: string; details?: unknown } = {
        error: error.message,
        code: error.code,
      };
      if (error.details !== undefined) {
        response.details = error.details;
      }
      res.status(error.httpStatus).json(response);
      return;
    }

    // Unknown/untyped errors: log everything internally, return a generic message
    requestLogger.error(
      {
        err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        url: req.url,
        method: req.method,
        requestId: req.requestId,
      },
      'Unhandled error',
    );
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });

  return app;
}
