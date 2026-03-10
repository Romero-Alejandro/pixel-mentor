import pino from 'pino';

import {
  GetLessonUseCase,
  GetSessionUseCase,
  ListLessonsUseCase,
  ListSessionsUseCase,
} from './application/use-cases';

import { config } from '@/config';
import { prisma } from '@/infrastructure/adapters/database/client.js';
import { PrismaLessonRepository } from '@/infrastructure/adapters/database/repositories/lesson-repository.js';
import { PrismaSessionRepository } from '@/infrastructure/adapters/database/repositories/session-repository.js';
import { PrismaInteractionRepository } from '@/infrastructure/adapters/database/repositories/interaction-repository.js';
import { GeminiAIModelAdapter } from '@/infrastructure/adapters/ai/gemini-adapter.js';
import { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case.js';
import { createApp } from '@/infrastructure/adapters/http/server.js';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

async function initializeDependencies(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
  } catch (error) {
    logger.fatal(error, 'Database connection failed');
    process.exit(1);
  }
}

function initializeContainer() {
  const lessonRepository = new PrismaLessonRepository();
  const sessionRepository = new PrismaSessionRepository();
  const interactionRepository = new PrismaInteractionRepository();
  const aiModel = new GeminiAIModelAdapter(config.GEMINI_API_KEY);

  return {
    orchestrateUseCase: new OrchestrateLessonUseCase(
      sessionRepository,
      interactionRepository,
      lessonRepository,
      aiModel,
    ),
    getLessonUseCase: new GetLessonUseCase(lessonRepository),
    listLessonsUseCase: new ListLessonsUseCase(lessonRepository),
    getSessionUseCase: new GetSessionUseCase(sessionRepository),
    listSessionsUseCase: new ListSessionsUseCase(sessionRepository),
  };
}

async function bootstrap(): Promise<void> {
  await initializeDependencies();
  const container = initializeContainer();

  const server = createApp({
    config,
    logger,
    prisma,
    ...container,
  }).listen(config.PORT, () => {
    logger.info(`API running on port ${config.PORT}`);
  });

  server.on('error', (err: Error) => {
    logger.fatal(err, 'Server error');
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    let closed = false;

    server.close((closeErr) => {
      if (closeErr) {
        logger.error(closeErr, 'Error closing server');
      }
      prisma
        .$disconnect()
        .then(() => {
          logger.info('Database disconnected');
          closed = true;
          process.exit(0);
        })
        .catch((e) => {
          logger.error(e, 'Error disconnecting database');
          process.exit(1);
        });
    });

    setTimeout(() => {
      if (!closed) {
        logger.warn('Force exiting after 10s');
        process.exit(1);
      }
    }, 10000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err: Error) => {
  logger.fatal(err, 'Bootstrap failed');
  process.exit(1);
});
