import type { Server } from 'node:http';

import { createLogger } from '@/shared/logger/logger.js';

import { buildContainer } from '@/main/container.js';
import { createApp } from '@/main/app.js';

import { config, getFeatureFlagService } from '@/shared/config';
import { prisma } from '@/database/client.js';
import { runStagingValidation } from '@/shared/monitoring/staging-validation.js';
import { initializeAIServices } from '@/shared/ai/ai-service.provider.js';

// Cross-feature use cases assembled at the composition root
import { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case.js';
import { LessonCompletionService } from '@/features/recipe/application/services/lesson-completion.service.js';

const logger = createLogger(config);

async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
  } catch (error: unknown) {
    logger.fatal(error, 'Database connection failed');
    process.exit(1);
  }
}

function setupGracefulShutdown(server: Server, shutdownSignal: string): void {
  logger.info({ signal: shutdownSignal }, 'Received shutdown signal');
  let isClosed = false;

  server.close((error?: Error) => {
    if (error) {
      logger.error(error, 'Error closing server');
    }

    prisma
      .$disconnect()
      .then(() => {
        logger.info('Database disconnected');
        isClosed = true;
        process.exit(0);
      })
      .catch((disconnectError: unknown) => {
        logger.error(disconnectError, 'Error disconnecting database');
        process.exit(1);
      });
  });

  setTimeout(() => {
    if (!isClosed) {
      logger.warn('Force exiting after timeout');
      process.exit(1);
    }
  }, config.REQUEST_TIMEOUT_MS).unref();
}

async function bootstrap(): Promise<void> {
  await verifyDatabaseConnection();

  // Log streaming configuration
  logger.info({ ENABLE_STREAMING: config.ENABLE_STREAMING }, 'Configuration loaded');

  // Create repos needed for AI service FIRST
  // These are created directly to avoid circular dependencies
  const { FileSystemPromptRepository } =
    await import('@/features/recipe/infrastructure/persistence/file-system-prompt.repository.js');
  const { PrismaKnowledgeChunkRepository } =
    await import('@/features/knowledge/infrastructure/persistence/prisma-knowledge-chunk.repository.js');
  const promptRepo = new FileSystemPromptRepository();
  const knowledgeRepo = new PrismaKnowledgeChunkRepository();

  // Initialize the centralized AI service provider with promptRepo
  // This validates the provider config and creates all AI adapters once
  const aiServices = initializeAIServices(config, promptRepo, knowledgeRepo, logger);

  // Build the main container with all feature containers
  const container = buildContainer(config, logger, aiServices.aiModel);

  // Run staging validation (logs banner if new engine is active)
  const featureFlagService = getFeatureFlagService();
  runStagingValidation(featureFlagService);

  // Assemble the cross-feature orchestrate use case. It spans several
  // bounded contexts (session, recipe, knowledge, activity, auth,
  // evaluation), so it lives at the composition root instead of any
  // single feature container.
  const orchestrateUseCase = new OrchestrateRecipeUseCase(
    container.session.sessionRepository,
    container.session.interactionRepository,
    container.recipe.recipeRepository,
    container.knowledge.conceptRepository,
    container.activity.activityRepository,
    container.knowledge.atomRepository,
    container.auth.userRepository,
    aiServices.aiModel, // aiModel
    aiServices.questionClassifier, // questionClassifier
    aiServices.ragService, // ragService
    aiServices.comprehensionEvaluator, // comprehensionEvaluator
    container.evaluation.lessonEvaluator,
    container.session.advisoryLock,
    undefined, // contextWindowService
    featureFlagService,
    container.activity.activityAttemptRepository,
  );

  // The recipe container already exposes a StartRecipeUseCase built from the
  // same repositories — reuse it instead of constructing a duplicate.
  const startRecipeUseCase = container.recipe.startRecipeUseCase;

  // Mission-report real-accuracy recomputation — shares the completion flow's
  // ActivityAttemptRepository so both paths read the same attempt data.
  const lessonCompletionService = new LessonCompletionService(
    container.activity.activityAttemptRepository,
  );

  // Create and configure Express app — all dependencies flow through DI
  const app = createApp({
    config,
    logger,
    auth: container.auth,
    recipe: container.recipe,
    session: container.session,
    gamification: container.gamification,
    class: container.class,
    tts: container.tts,
    group: container.group,
    clinical: container.clinical,
    orchestrateUseCase,
    startRecipeUseCase,
    lessonCompletionService,
  });

  // Express app.listen() returns http.Server in Express 5
  const server: Server = app.listen(config.PORT, () => {
    logger.info(`🚀 API running on http://localhost:${config.PORT}`);
  });

  server.on('error', (error: unknown) => {
    // Check for EADDRINUSE to provide a helpful message
    const err = error as { code?: string };
    if (err.code === 'EADDRINUSE') {
      logger.fatal(
        { port: config.PORT },
        `Port ${config.PORT} is already in use. Another instance of the API may be running. ` +
          'Kill the existing process or change the PORT environment variable.',
      );
    } else {
      logger.fatal(error, 'Server error');
    }
    process.exit(1);
  });

  process.on('SIGTERM', () => setupGracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => setupGracefulShutdown(server, 'SIGINT'));
}

bootstrap().catch((error: Error) => {
  logger.fatal(error, 'Bootstrap failed');
  process.exit(1);
});
