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
import { AdminUserService } from './application/services/admin-user.service.js';
import { QuestionAnsweringUseCase } from './application/use-cases/question/question-answering.use-case.js';
import { ProgressService } from './domain/services/progress.service.js';
import { EventService } from './domain/services/event.service.js';
import { CompetencyService } from './domain/services/competency.service.js';
import { TTSProviderFactory } from './infrastructure/adapters/tts/tts-factory';
import { GameEngineCore } from './game-engine/index.js';
import { LevelService } from './game-engine/level.service.js';
import { StreakService } from './game-engine/streak.service.js';
import { ClassService } from './application/services/class.service.js';
import { ClassAIService } from './application/services/class-ai.service.js';
import { RecipeAIService } from './application/services/recipe-ai.service.js';
import { ClassTemplateService } from './application/services/class-template.service.js';
import { RecipeService } from './application/services/recipe.service.js';
import {
  StrategyRegistry,
  LessonCompletionStrategy,
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
  StreakBonusStrategy,
} from './game-engine/strategies/index.js';
import type {
  IUserGamificationRepository,
  IBadgeRepository,
} from './domain/ports/gamification-ports.js';

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
import { PrismaTagRepository } from '@/infrastructure/adapters/database/repositories/tag-repository.js';
import { PrismaRecipeTagRepository } from '@/infrastructure/adapters/database/repositories/recipe-tag-repository.js';
import { PrismaCompetencyMasteryRepository } from '@/infrastructure/adapters/database/repositories/competency-mastery-repository.js';
import { AIAdapterFactory } from '@/infrastructure/adapters/ai/ai-adapter-factory.js';
import { FileSystemPromptRepository } from '@/infrastructure/adapters/prompts/file-system-prompt-repository.js';
import { PostgresAdvisoryLockManager } from '@/infrastructure/adapters/database/repositories/advisory-lock.js';
import { PrismaUserGamificationRepository } from '@/infrastructure/repositories/prisma-user-gamification.repository.js';
import { PrismaBadgeRepository } from '@/infrastructure/repositories/prisma-badge.repository.js';
import { PrismaClassRepository } from '@/infrastructure/repositories/prisma-class.repository.js';
import { PrismaClassLessonRepository } from '@/infrastructure/repositories/prisma-class-lesson.repository.js';
import { PrismaClassVersionRepository } from '@/infrastructure/repositories/prisma-class-version.repository.js';
import { PrismaClassTemplateRepository } from '@/infrastructure/repositories/prisma-class-template.repository.js';
import type { Config } from '@/config';
import { LessonEvaluatorUseCase } from '@/evaluator/index.js';
import { SafePromptBuilder } from '@/prompt/safe.prompt.builder.js';
import { SchemaValidator } from '@/validation/schema.validator.js';
import { LLMClientAdapter } from '@/llm/adapters/llm-client.adapter.js';
import { getFeatureFlagService } from '@/config/index.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
    competencyRepository: new PrismaCompetencyMasteryRepository(),
    tagRepository: new PrismaTagRepository(),
    recipeTagRepository: new PrismaRecipeTagRepository(),
    competencyMasteryRepository: new PrismaCompetencyMasteryRepository(),
    promptRepository: new FileSystemPromptRepository(),
    advisoryLock: PostgresAdvisoryLockManager.getInstance(),
    // Class repositories
    classRepository: new PrismaClassRepository(),
    classLessonRepository: new PrismaClassLessonRepository(),
    classVersionRepository: new PrismaClassVersionRepository(),
    classTemplateRepository: new PrismaClassTemplateRepository(),
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

  // Class services
  const classService = new ClassService(
    repositories.classRepository,
    repositories.classLessonRepository,
    repositories.classVersionRepository,
  );

  const classAIService = new ClassAIService(
    repositories.classRepository,
    repositories.classLessonRepository,
    providers.ai.aiModel,
  );

  const classTemplateService = new ClassTemplateService(
    repositories.classTemplateRepository,
    repositories.classRepository,
  );

  // Admin services
  const adminUserService = new AdminUserService(repositories.userRepository);

  // Recipe service
  const recipeService = new RecipeService(
    repositories.recipeRepository,
    repositories.atomRepository,
  );

  // Recipe AI service
  const recipeAIService = new RecipeAIService(providers.ai.aiModel);

  // Gamification repositories (implemented in GAM-04)
  const gamificationRepositories: {
    userGamificationRepository: IUserGamificationRepository;
    badgeRepository: IBadgeRepository;
    levelService: LevelService;
    streakService: StreakService;
  } = {
    userGamificationRepository: new PrismaUserGamificationRepository(),
    badgeRepository: new PrismaBadgeRepository(),
    levelService: new LevelService(),
    streakService: new StreakService(new PrismaUserGamificationRepository()),
  };

  // Create and configure strategy registry with all strategies
  const strategyRegistry = new StrategyRegistry(logger);
  strategyRegistry.register(new LessonCompletionStrategy());
  strategyRegistry.register(new FirstLessonBadgeStrategy());
  strategyRegistry.register(new StreakMilestone7Strategy());
  strategyRegistry.register(new StreakMilestone30Strategy());
  strategyRegistry.register(new StreakBonusStrategy());

  // Initialize gamification engine
  const gameEngine = new GameEngineCore(
    gamificationRepositories.userGamificationRepository,
    gamificationRepositories.badgeRepository,
    strategyRegistry,
    gamificationRepositories.streakService,
    undefined, // Use default event bus
    logger,
  );
  gameEngine.initialize();

  const useCases = {
    registerUseCase: new RegisterUseCase(repositories.userRepository),
    loginUseCase: new LoginUseCase(repositories.userRepository),
    verifyTokenUseCase: new VerifyTokenUseCase(repositories.userRepository),
    resetSessionUseCase: new ResetSessionUseCase(repositories.sessionRepository),
    completeSessionUseCase: new CompleteSessionUseCase(),
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
    // Create LessonEvaluatorUseCase with required dependencies
    lessonEvaluator: new LessonEvaluatorUseCase(
      new LLMClientAdapter(providers.ai.aiModel),
      new SafePromptBuilder(),
      new SchemaValidator(),
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
      // LessonEvaluatorUseCase for new evaluation engine
      new LessonEvaluatorUseCase(
        new LLMClientAdapter(providers.ai.aiModel),
        new SafePromptBuilder(),
        new SchemaValidator(),
      ),
      repositories.advisoryLock,
      undefined, // contextWindowService
      getFeatureFlagService(), // FeatureFlagService for cohort-based routing
      repositories.activityAttemptRepository, // For accuracy calculation
    ),
  };

  return {
    repositories,
    providers,
    services,
    useCases,
    gameEngine,
    gamificationRepositories,
    strategyRegistry,
    classService,
    classAIService,
    classTemplateService,
    recipeService,
    recipeAIService,
    adminUserService,
  };
}
