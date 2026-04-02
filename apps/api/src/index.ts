import type { Server } from 'node:http';

import { createLogger } from '@/shared/logger/logger.js';

import { buildContainer } from './main/container.js';
import { createApp } from './main/app.js';

import { config, getFeatureFlagService } from '@/shared/config';
import { prisma } from '@/database/client.js';
import { runStagingValidation } from '@/shared/monitoring/staging-validation.js';
import { AIAdapterFactory, type AIAdapterInstances } from '@/shared/ai/ai-adapter-factory.js';

// Import the orchestrate use case and others that are still in the old location
// These will be migrated in future phases
import { OrchestrateRecipeUseCase } from '@/features/recipe/application/use-cases/orchestrate-recipe.use-case.js';
import { StartRecipeUseCase } from '@/features/recipe/application/use-cases/start-recipe.use-case.js';

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
      .catch((disconnectError: any) => {
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

  // Build the main container with all feature containers
  const container = buildContainer(config, logger);

  // Create AI adapter factory with full configuration
  // This provides questionClassifier, ragService, comprehensionEvaluator, and aiModel
  const aiProvider = AIAdapterFactory.createResilient({
    provider: config.LLM_PROVIDER,
    geminiApiKey: config.GEMINI_API_KEY,
    openRouterApiKey: config.OPENROUTER_API_KEY,
    groqApiKey: config.GROQ_API_KEY,
    defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
    defaultModelGemini: config.DEFAULT_MODEL_GEMINI,
    defaultModelGroq: config.DEFAULT_MODEL_GROQ,
    promptRepo: container.recipe.promptRepository,
    knowledgeChunkRepository: null as any, // Will be injected from knowledge container
    logger,
  }) as AIAdapterInstances;

  // Run staging validation (logs banner if new engine is active)
  const featureFlagService = getFeatureFlagService();
  runStagingValidation(featureFlagService);

  // Create orchestrate use case with dependencies from various containers
  // This is needed because OrchestrateRecipeUseCase has complex dependencies
  // that span multiple features
  const orchestrateUseCase = new OrchestrateRecipeUseCase(
    container.session.sessionRepository,
    container.session.interactionRepository,
    container.recipe.recipeRepository,
    container.knowledge.conceptRepository,
    container.activity.activityRepository,
    container.knowledge.atomRepository,
    container.auth.userRepository,
    aiProvider.aiModel, // aiModel
    aiProvider.questionClassifier, // questionClassifier
    aiProvider.ragService, // ragService
    aiProvider.comprehensionEvaluator, // comprehensionEvaluator
    container.evaluation.lessonEvaluator,
    container.session.advisoryLock,
    undefined, // contextWindowService
    featureFlagService,
    container.activity.activityAttemptRepository,
  );

  // Create start recipe use case
  const startRecipeUseCase = new StartRecipeUseCase(
    container.recipe.recipeRepository,
    container.session.sessionRepository,
  );

  // Expose these globally for the app to use (temporary solution)
  // Using 'any' type to bypass TypeScript issues with duplicate class declarations
  (globalThis as any).__orchestrateUseCase = orchestrateUseCase;
  (globalThis as any).__startRecipeUseCase = startRecipeUseCase;

  // Create and configure Express app
  const app = createApp({
    config,
    logger,
    auth: container.auth,
    recipe: container.recipe,
    session: container.session,
    gamification: container.gamification,
    class: container.class,
    tts: container.tts,
  });

  // Express app.listen() returns http.Server in Express 5
  const server: Server = app.listen(config.PORT, () => {
    logger.info(`API running on port ${config.PORT}`);
  });

  server.on('error', (error: Error) => {
    logger.fatal(error, 'Server error');
    process.exit(1);
  });

  process.on('SIGTERM', () => setupGracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => setupGracefulShutdown(server, 'SIGINT'));
}

bootstrap().catch((error: Error) => {
  logger.fatal(error, 'Bootstrap failed');
  process.exit(1);
});
