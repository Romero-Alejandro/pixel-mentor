import type pino from 'pino';

import {
  GetRecipeUseCase,
  GetSessionUseCase,
  ListRecipesUseCase,
  ListSessionsUseCase,
  OrchestrateRecipeUseCase,
  StartRecipeUseCase,
  AttemptActivityUseCase,
  TrackProgressUseCase,
  LogEventUseCase,
} from './application/use-cases';
import { ResetSessionUseCase } from './application/use-cases/session/reset-session.use-case.js';
import { CompleteSessionUseCase } from './application/use-cases/session/complete-session.use-case.js';
import { RegisterUseCase } from './application/use-cases/auth/register.use-case.js';
import { LoginUseCase } from './application/use-cases/auth/login.use-case.js';
import { VerifyTokenUseCase } from './application/use-cases/auth/verify-token.use-case.js';
import { QuestionAnsweringUseCase } from './application/use-cases/question/question-answering.use-case.js';
import { ProgressService } from './domain/services/progress.service.js';
import { EventService } from './domain/services/event.service.js';
import { CompetencyService } from './domain/services/competency.service.js';

import { PrismaRecipeRepository } from '@/infrastructure/adapters/database/repositories/recipe-repository.js';
import { PrismaConceptRepository } from '@/infrastructure/adapters/database/repositories/concept-repository.js';
import { PrismaActivityRepository } from '@/infrastructure/adapters/database/repositories/activity-repository.js';
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

import type { Config } from '@/config';
import { TTSProviderFactory } from './infrastructure/adapters/tts/tts-factory';

export function buildContainer(config: Config, logger: pino.Logger) {
  const repositories = {
    recipeRepository: new PrismaRecipeRepository(),
    conceptRepository: new PrismaConceptRepository(),
    activityRepository: new PrismaActivityRepository(),
    atomRepository: new PrismaAtomRepository(),
    knowledgeChunkRepository: new PrismaKnowledgeChunkRepository(),
    sessionRepository: new PrismaSessionRepository(),
    interactionRepository: new PrismaInteractionRepository(),
    userRepository: new PrismaUserRepository(),
    activityAttemptRepository: new PrismaActivityAttemptRepository(),
    progressRepository: new PrismaProgressRepository(),
    eventLogRepository: new PrismaEventLogRepository(),
    competencyRepository: new PrismaCompetencyRepository(),
    tagRepository: new PrismaTagRepository(),
    recipeTagRepository: new PrismaRecipeTagRepository(),
    competencyMasteryRepository: new PrismaCompetencyMasteryRepository(),
    promptRepository: new FileSystemPromptRepository(),
    advisoryLock: PostgresAdvisoryLockManager.getInstance(),
  };

  const providers = {
    ai: AIAdapterFactory.createResilient({
      provider: config.LLM_PROVIDER,
      geminiApiKey: config.GEMINI_API_KEY,
      openRouterApiKey: config.OPENROUTER_API_KEY,
      groqApiKey: config.GROQ_API_KEY,
      defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
      defaultModelGemini: config.DEFAULT_MODEL_GEMINI,
      defaultModelGroq: config.DEFAULT_MODEL_GROQ,
      // CRÍTICO: Estas llaves deben existir en el objeto 'repositories' definido arriba
      promptRepo: repositories.promptRepository,
      knowledgeChunkRepository: repositories.knowledgeChunkRepository,
      logger,
    }),
    tts: TTSProviderFactory.create({
      provider: config.TTS_PROVIDER,
      googleFreeConfig: { logger },
      logger,
    }),
  };

  const services = {
    progress: new ProgressService(repositories.progressRepository),
    event: new EventService(repositories.eventLogRepository),
    competency: new CompetencyService(repositories.atomRepository),
  };

  const useCases = {
    registerUseCase: new RegisterUseCase(repositories.userRepository),
    loginUseCase: new LoginUseCase(repositories.userRepository),
    verifyTokenUseCase: new VerifyTokenUseCase(repositories.userRepository),
    resetSessionUseCase: new ResetSessionUseCase(
      repositories.sessionRepository,
      repositories.interactionRepository,
    ),
    completeSessionUseCase: new CompleteSessionUseCase(repositories.sessionRepository),
    getRecipeUseCase: new GetRecipeUseCase(repositories.recipeRepository),
    listRecipesUseCase: new ListRecipesUseCase(repositories.recipeRepository),
    getSessionUseCase: new GetSessionUseCase(repositories.sessionRepository),
    listSessionsUseCase: new ListSessionsUseCase(repositories.sessionRepository),
    startRecipeUseCase: new StartRecipeUseCase(
      repositories.recipeRepository,
      repositories.sessionRepository,
    ),
    attemptActivityUseCase: new AttemptActivityUseCase(
      repositories.activityAttemptRepository,
      repositories.atomRepository,
    ),
    trackProgressUseCase: new TrackProgressUseCase(repositories.progressRepository),
    logEventUseCase: new LogEventUseCase(repositories.eventLogRepository),
    questionAnsweringUseCase: new QuestionAnsweringUseCase(
      repositories.recipeRepository,
      repositories.conceptRepository,
      providers.ai.aiModel,
    ),
    orchestrateUseCase: new OrchestrateRecipeUseCase(
      repositories.sessionRepository,
      repositories.interactionRepository,
      repositories.recipeRepository,
      repositories.conceptRepository,
      repositories.activityRepository,
      repositories.atomRepository,
      repositories.userRepository,
      providers.ai.aiModel,
      providers.ai.questionClassifier,
      providers.ai.ragService,
      providers.ai.comprehensionEvaluator,
      repositories.advisoryLock,
    ),
  };

  return { repositories, providers, services, useCases };
}
