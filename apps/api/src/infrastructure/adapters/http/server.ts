import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createLeccionRouter } from './routes/leccion';
import { createLessonsRouter } from './routes/lessons';
import { createSessionsRouter } from './routes/sessions';
import { requestIdMiddleware } from './middleware/request-id';
import { timeoutMiddleware } from './middleware/timeout';
import { requestLoggerMiddleware } from './middleware/request-logger';
import type pino from 'pino';
import { PrismaClient } from '@/infrastructure/adapters/database/client.js';
import type { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case';
import type { GetLessonUseCase } from '@/application/use-cases/lesson/get-lesson.use-case';
import type { ListLessonsUseCase } from '@/application/use-cases/lesson/list-lessons.use-case';
import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case';
import type { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case';

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
  };
  logger: pino.Logger;
  orchestrateUseCase: OrchestrateLessonUseCase;
  prisma: PrismaClient;
  getLessonUseCase: GetLessonUseCase;
  listLessonsUseCase: ListLessonsUseCase;
  getSessionUseCase: GetSessionUseCase;
  listSessionsUseCase: ListSessionsUseCase;
}

export function createApp(deps: ServerDependencies): Express {
  const {
    config,
    logger,
    orchestrateUseCase,
    prisma,
    getLessonUseCase,
    listLessonsUseCase,
    getSessionUseCase,
    listSessionsUseCase,
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

  app.use('/api/leccion', createLeccionRouter(orchestrateUseCase));
  app.use('/api/lessons', createLessonsRouter(getLessonUseCase, listLessonsUseCase));
  app.use('/api/sessions', createSessionsRouter(getSessionUseCase, listSessionsUseCase));

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
