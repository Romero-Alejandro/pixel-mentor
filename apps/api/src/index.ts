import pino from 'pino';

import {
  GetRecipeUseCase,
  GetSessionUseCase,
  ListRecipesUseCase,
  ListSessionsUseCase,
  OrchestrateRecipeUseCase,
} from './application/use-cases';
import { ResetSessionUseCase } from './application/use-cases/session/reset-session.use-case.js';
import { RegisterUseCase } from './application/use-cases/auth/register.use-case.js';
import { LoginUseCase } from './application/use-cases/auth/login.use-case.js';
import { VerifyTokenUseCase } from './application/use-cases/auth/verify-token.use-case.js';
import {
  StartRecipeUseCase,
  AttemptActivityUseCase,
  TrackProgressUseCase,
  LogEventUseCase,
} from './application/use-cases';
import { ProgressService } from './domain/services/progress.service.js';
import { EventService } from './domain/services/event.service.js';
import { CompetencyService } from './domain/services/competency.service.js';

import { config } from '@/config';
import { prisma } from '@/infrastructure/adapters/database/client.js';
import { PrismaRecipeRepository } from '@/infrastructure/adapters/database/repositories/recipe-repository.js';
import { PrismaSessionRepository } from '@/infrastructure/adapters/database/repositories/session-repository.js';
import { PrismaInteractionRepository } from '@/infrastructure/adapters/database/repositories/interaction-repository.js';
import { PrismaKnowledgeChunkRepository } from '@/infrastructure/adapters/database/repositories/knowledge-chunk-repository.js';
import { PrismaUserRepository } from '@/infrastructure/adapters/database/repositories/user-repository.js';
import { PrismaAtomRepository } from '@/infrastructure/adapters/database/repositories/atom-repository.js';
import { PrismaActivityAttemptRepository } from '@/infrastructure/adapters/database/repositories/activity-attempt-repository.js';
import { PrismaProgressRepository } from '@/infrastructure/adapters/database/repositories/progress-repository.js';
import { PrismaEventLogRepository } from '@/infrastructure/adapters/database/repositories/event-log-repository.js';
import { PrismaCompetencyRepository } from '@/infrastructure/adapters/database/repositories/competency-repository.js';
import { PrismaTagRepository } from '@/infrastructure/adapters/database/repositories/tag-repository.js';
import { PrismaRecipeTagRepository } from '@/infrastructure/adapters/database/repositories/recipe-tag-repository.js';
import { PrismaCompetencyMasteryRepository } from '@/infrastructure/adapters/database/repositories/competency-mastery-repository.js';
import { AIAdapterFactory } from '@/infrastructure/adapters/ai/ai-adapter-factory.js';
import { FileSystemPromptRepository } from '@/infrastructure/adapters/prompts/file-system-prompt-repository.js';
import { PostgresAdvisoryLockManager } from '@/infrastructure/adapters/database/repositories/advisory-lock.js';
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
  const recipeRepository = new PrismaRecipeRepository();
  const atomRepository = new PrismaAtomRepository();
  const knowledgeChunkRepository = new PrismaKnowledgeChunkRepository();
  const sessionRepository = new PrismaSessionRepository();
  const interactionRepository = new PrismaInteractionRepository();
  const userRepo = new PrismaUserRepository();
  const activityAttemptRepo = new PrismaActivityAttemptRepository();
  const progressRepo = new PrismaProgressRepository();
  const eventLogRepo = new PrismaEventLogRepository();
  const competencyRepo = new PrismaCompetencyRepository();
  const tagRepo = new PrismaTagRepository();
  const recipeTagRepo = new PrismaRecipeTagRepository();
  const competencyMasteryRepo = new PrismaCompetencyMasteryRepository();
  const promptRepo = new FileSystemPromptRepository();
  const { aiModel, questionClassifier, comprehensionEvaluator, ragService } =
    AIAdapterFactory.create({
      provider: config.LLM_PROVIDER,
      geminiApiKey: config.GEMINI_API_KEY,
      openRouterApiKey: config.OPENROUTER_API_KEY,
      defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
      promptRepo,
      knowledgeChunkRepository,
      logger,
    });
  const advisoryLockManager = PostgresAdvisoryLockManager.getInstance();

  const registerUseCase = new RegisterUseCase(userRepo);
  const loginUseCase = new LoginUseCase(userRepo);
  const verifyTokenUseCase = new VerifyTokenUseCase(userRepo);
  const resetSessionUseCase = new ResetSessionUseCase(sessionRepository, interactionRepository);

  const startRecipeUseCase = new StartRecipeUseCase(recipeRepository, sessionRepository);
  const attemptActivityUseCase = new AttemptActivityUseCase(activityAttemptRepo, atomRepository);
  const trackProgressUseCase = new TrackProgressUseCase(progressRepo);
  const logEventUseCase = new LogEventUseCase(eventLogRepo);
  const progressService = new ProgressService(progressRepo);
  const eventService = new EventService(eventLogRepo);
  const competencyService = new CompetencyService(atomRepository);

  return {
    userRepo,
    registerUseCase,
    loginUseCase,
    verifyTokenUseCase,
    resetSessionUseCase,
    orchestrateUseCase: new OrchestrateRecipeUseCase(
      sessionRepository,
      interactionRepository,
      recipeRepository,
      atomRepository,
      aiModel,
      questionClassifier,
      ragService,
      comprehensionEvaluator,
      advisoryLockManager,
    ),
    getRecipeUseCase: new GetRecipeUseCase(recipeRepository),
    listRecipesUseCase: new ListRecipesUseCase(recipeRepository),
    getSessionUseCase: new GetSessionUseCase(sessionRepository),
    listSessionsUseCase: new ListSessionsUseCase(sessionRepository),
    activityAttemptRepo,
    progressRepo,
    eventLogRepo,
    competencyRepo,
    startRecipeUseCase,
    attemptActivityUseCase,
    trackProgressUseCase,
    logEventUseCase,
    progressService,
    eventService,
    competencyService,
    tagRepo,
    recipeTagRepo,
    competencyMasteryRepo,
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
