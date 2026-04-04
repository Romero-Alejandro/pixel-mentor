import type pino from 'pino';

import type { Config } from '@/shared/config/index.js';
import { AIAdapterFactory, type AIAdapterFactoryOptions } from './ai-adapter-factory.js';

import type { AIService } from '@/features/recipe/domain/ports/ai-service.port.js';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
} from '@/features/recipe/domain/ports/question-classifier.port.js';
import type { RAGService } from '@/features/recipe/domain/ports/rag-service.port.js';
import type { PromptRepository } from '@/features/recipe/domain/ports/prompt.repository.port.js';
import type { KnowledgeChunkRepository } from '@/features/knowledge/domain/ports/knowledge-chunk.repository.port.js';

// ==================== Types ====================

export interface IAIServiceProvider {
  aiModel: AIService;
  questionClassifier: QuestionClassifier;
  comprehensionEvaluator: ComprehensionEvaluator;
  ragService: RAGService;
  health: () => ProviderHealthStatus;
}

export interface ProviderHealthStatus {
  primaryProvider: string;
  availableProviders: string[];
  isHealthy: boolean;
}

// ==================== Provider Configuration ====================

/**
 * Maps provider names to their required API key config property.
 */
const PROVIDER_API_KEY_MAP: Record<string, keyof Config> = {
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
} as const;

/**
 * All supported providers in priority order for fallback.
 * Groq is first by design (primary provider).
 */
const PROVIDER_PRIORITY: readonly ('gemini' | 'groq' | 'openrouter')[] = [
  'groq',
  'gemini',
  'openrouter',
];

// ==================== Validation ====================

/**
 * Validates that the configured provider has its API key set.
 * Returns list of providers that have valid API keys.
 */
function validateProviderConfig(
  config: Config,
  logger: pino.Logger,
): { primaryProvider: string; availableProviders: string[] } {
  const primaryProvider = config.LLM_PROVIDER;
  const primaryApiKey = PROVIDER_API_KEY_MAP[primaryProvider];

  if (!primaryApiKey) {
    throw new Error(`Unknown LLM provider configured: "${primaryProvider}"`);
  }

  const primaryKeyValue = config[primaryApiKey];
  if (!primaryKeyValue) {
    throw new Error(
      `LLM provider "${primaryProvider}" requires ${primaryApiKey} to be set. ` +
        `Set this environment variable or change LLM_PROVIDER to a configured provider.`,
    );
  }

  // Determine which providers are available (have their API keys)
  const availableProviders = PROVIDER_PRIORITY.filter((provider) => {
    const keyName = PROVIDER_API_KEY_MAP[provider];
    return !!config[keyName];
  });

  if (availableProviders.length === 0) {
    throw new Error('No AI provider API keys are configured. At least one must be set.');
  }

  logger.info(
    {
      primaryProvider,
      availableProviders,
      primaryModel: getPrimaryModel(config),
    },
    'AI service provider initialized',
  );

  return { primaryProvider, availableProviders };
}

/**
 * Returns the configured model name for the primary provider.
 */
function getPrimaryModel(config: Config): string {
  switch (config.LLM_PROVIDER) {
    case 'gemini':
      return config.DEFAULT_MODEL_GEMINI;
    case 'groq':
      return config.DEFAULT_MODEL_GROQ;
    case 'openrouter':
      return config.DEFAULT_MODEL_OPENROUTER;
  }
}

// ==================== Provider Factory ====================

/**
 * Creates an AI service provider with resilient fallback.
 *
 * The provider initializes adapters for all available providers (those with valid API keys)
 * and uses the resilient adapter pattern to automatically fallback to secondary providers
 * if the primary fails.
 *
 * Note: promptRepo and knowledgeChunkRepository can be null at init time.
 * They are injected later when specific use cases need them.
 */
function createProvider(
  config: Config,
  promptRepo: PromptRepository | null,
  knowledgeChunkRepository: KnowledgeChunkRepository | null,
  logger: pino.Logger,
): IAIServiceProvider {
  const { primaryProvider, availableProviders } = validateProviderConfig(config, logger);

  const factoryOptions: AIAdapterFactoryOptions = {
    provider: primaryProvider as 'gemini' | 'groq' | 'openrouter',
    geminiApiKey: config.GEMINI_API_KEY,
    openRouterApiKey: config.OPENROUTER_API_KEY,
    groqApiKey: config.GROQ_API_KEY,
    defaultModelGemini: config.DEFAULT_MODEL_GEMINI,
    defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
    defaultModelGroq: config.DEFAULT_MODEL_GROQ,
    promptRepo: promptRepo as PromptRepository,
    knowledgeChunkRepository: knowledgeChunkRepository as KnowledgeChunkRepository,
    logger,
  };

  // Use the resilient factory which creates adapters for all available providers
  // and wraps them in circuit-breaker protected resilient adapters
  const instances = AIAdapterFactory.createResilient(factoryOptions);

  let healthStatus: ProviderHealthStatus | null = null;

  const provider: IAIServiceProvider = {
    aiModel: instances.aiModel,
    questionClassifier: instances.questionClassifier,
    comprehensionEvaluator: instances.comprehensionEvaluator,
    ragService: instances.ragService,
    health: () => {
      if (!healthStatus) {
        healthStatus = {
          primaryProvider,
          availableProviders,
          isHealthy: availableProviders.length > 0,
        };
      }
      return healthStatus;
    },
  };

  return provider;
}

// ==================== Module-Level Singleton ====================

let _provider: IAIServiceProvider | null = null;

/**
 * Initialize the AI service provider.
 * Must be called once during application bootstrap.
 *
 * @throws Error if the primary provider is not configured or no providers are available
 */
export function initializeAIServices(
  config: Config,
  promptRepo: PromptRepository | null,
  knowledgeChunkRepository: KnowledgeChunkRepository | null,
  logger: pino.Logger,
): IAIServiceProvider {
  if (_provider) {
    logger.warn('AI services already initialized, returning existing instance');
    return _provider;
  }

  _provider = createProvider(config, promptRepo, knowledgeChunkRepository, logger);
  return _provider;
}

/**
 * Get the initialized AI service provider.
 *
 * @throws Error if AI services have not been initialized
 */
export function getAIServices(): IAIServiceProvider {
  if (!_provider) {
    throw new Error(
      'AI services not initialized. Call initializeAIServices() during application bootstrap.',
    );
  }
  return _provider;
}

/**
 * Check if AI services have been initialized.
 */
export function isAIServicesInitialized(): boolean {
  return _provider !== null;
}

/**
 * Reset the AI service provider (primarily for testing).
 */
export function resetAIServices(): void {
  _provider = null;
}
