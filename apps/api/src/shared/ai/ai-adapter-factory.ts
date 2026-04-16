import type pino from 'pino';

import {
  GeminiAIModelAdapter,
  GeminiClassifierAdapter,
  GeminiComprehensionEvaluatorAdapter,
  GeminiRAGServiceAdapter,
} from './gemini/gemini-adapters';
import {
  OpenRouterAdapter,
  OpenRouterClassifierAdapter,
  OpenRouterComprehensionEvaluatorAdapter,
  OpenRouterRAGServiceAdapter,
} from './open-router/openrouter-adapters';
import {
  GroqAdapter,
  GroqClassifierAdapter,
  GroqComprehensionEvaluatorAdapter,
  GroqRAGServiceAdapter,
} from './groq/groq-adapters';
import {
  ResilientAIAdapter,
  ResilientClassifierAdapter,
  ResilientEvaluatorAdapter,
  ResilientRAGAdapter,
} from './resilient-ai-adapter';

import type { AIService } from '@/features/recipe/domain/ports/ai-service.port.js';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
} from '@/features/recipe/domain/ports/question-classifier.port.js';
import type { RAGService } from '@/features/recipe/domain/ports/rag-service.port.js';
import type { PromptRepository } from '@/features/recipe/domain/ports/prompt.repository.port.js';
import type { KnowledgeChunkRepository } from '@/features/knowledge/domain/ports/knowledge-chunk.repository.port.js';

// ==================== Types ====================

export type LLMProvider = 'gemini' | 'openrouter' | 'groq';

export interface AIAdapterFactoryOptions {
  provider: LLMProvider;
  geminiApiKey?: string;
  openRouterApiKey?: string;
  groqApiKey?: string;
  defaultModelGemini?: string;
  defaultModelOpenRouter?: string;
  defaultModelGroq?: string;
  promptRepo: PromptRepository;
  knowledgeChunkRepository: KnowledgeChunkRepository;
  logger?: pino.Logger;
  /**
   * Override the fallback order for providers.
   * If not provided, uses: [configured_provider, ...remaining_in_default_order]
   * Default order: ['groq', 'gemini', 'openrouter']
   */
  fallbackOrder?: readonly LLMProvider[];
}

export interface AIAdapterInstances {
  aiModel: AIService;
  questionClassifier: QuestionClassifier;
  comprehensionEvaluator: ComprehensionEvaluator;
  ragService: RAGService;
}

interface InitializationResult {
  provider: string;
  success: boolean;
  error?: string;
}

// ==================== Default Configuration ====================

/**
 * Default provider priority order for fallback.
 * Groq is first by design (primary provider).
 */
const DEFAULT_FALLBACK_ORDER: readonly LLMProvider[] = ['groq', 'gemini', 'openrouter'];

// ==================== Provider Strategies ====================

interface AIProviderStrategy {
  create(options: AIAdapterFactoryOptions): AIAdapterInstances;
}

class GeminiStrategy implements AIProviderStrategy {
  create(options: AIAdapterFactoryOptions): AIAdapterInstances {
    if (!options.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = options.defaultModelGemini || 'gemini-2.5-flash-lite';
    return {
      aiModel: new GeminiAIModelAdapter(
        options.promptRepo,
        options.geminiApiKey,
        model,
        options.logger,
      ),
      questionClassifier: new GeminiClassifierAdapter(options.geminiApiKey, options.logger),
      comprehensionEvaluator: new GeminiComprehensionEvaluatorAdapter(
        options.geminiApiKey,
        options.logger,
      ),
      ragService: new GeminiRAGServiceAdapter(
        options.geminiApiKey,
        options.knowledgeChunkRepository,
      ),
    };
  }
}

class GroqStrategy implements AIProviderStrategy {
  create(options: AIAdapterFactoryOptions): AIAdapterInstances {
    if (!options.groqApiKey) throw new Error('GROQ_API_KEY is not configured');
    const model = options.defaultModelGroq || 'llama-3.3-70b-versatile';
    const fastModel = 'llama-3.1-8b-instant';
    return {
      aiModel: new GroqAdapter(options.promptRepo, options.groqApiKey, model, options.logger),
      questionClassifier: new GroqClassifierAdapter(options.groqApiKey, fastModel, options.logger),
      comprehensionEvaluator: new GroqComprehensionEvaluatorAdapter(
        options.groqApiKey,
        fastModel,
        options.logger,
      ),
      ragService: new GroqRAGServiceAdapter(options.groqApiKey, options.knowledgeChunkRepository),
    };
  }
}

class OpenRouterStrategy implements AIProviderStrategy {
  create(options: AIAdapterFactoryOptions): AIAdapterInstances {
    if (!options.openRouterApiKey) throw new Error('OPENROUTER_API_KEY is not configured');
    const model = options.defaultModelOpenRouter || 'stepfun/step-3.5-flash:free';
    return {
      aiModel: new OpenRouterAdapter(
        options.promptRepo,
        options.openRouterApiKey,
        model,
        options.logger,
      ),
      questionClassifier: new OpenRouterClassifierAdapter(
        options.openRouterApiKey,
        model,
        options.logger,
      ),
      comprehensionEvaluator: new OpenRouterComprehensionEvaluatorAdapter(
        options.openRouterApiKey,
        model,
        options.logger,
      ),
      ragService: new OpenRouterRAGServiceAdapter(
        options.openRouterApiKey,
        options.knowledgeChunkRepository,
      ),
    };
  }
}

// ==================== Factory ====================

export class AIAdapterFactory {
  private static readonly strategies: Record<LLMProvider, AIProviderStrategy> = {
    gemini: new GeminiStrategy(),
    groq: new GroqStrategy(),
    openrouter: new OpenRouterStrategy(),
  };

  /**
   * Creates resilient AI adapters with automatic fallback between providers.
   *
   * How it works:
   * 1. Determines the order of providers to try (primary first, then fallback order)
   * 2. Attempts to initialize each provider, logging successes and failures
   * 3. Wraps all successful providers in resilient adapters with circuit breakers
   * 4. At runtime, if the primary provider fails, automatically falls back to the next
   *
   * @throws Error if no providers could be initialized
   */
  static createResilient(options: AIAdapterFactoryOptions): AIAdapterInstances {
    const logger = options.logger;
    const fallbackOrder = options.fallbackOrder ?? DEFAULT_FALLBACK_ORDER;

    // Build ordered provider list: primary first, then remaining in fallback order
    const orderedProviders = [
      options.provider,
      ...fallbackOrder.filter((p) => p !== options.provider),
    ];

    // Initialize each provider, tracking results
    const initResults: InitializationResult[] = [];
    const successfulInstances: AIAdapterInstances[] = [];

    for (const provider of orderedProviders) {
      try {
        const instances = this.strategies[provider].create(options);
        successfulInstances.push(instances);
        initResults.push({ provider, success: true });
        logger?.info({ provider }, 'AI provider initialized');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        initResults.push({ provider, success: false, error: errorMessage });
        logger?.warn({ provider, error: errorMessage }, 'AI provider initialization failed');
      }
    }

    // Log summary
    const successCount = initResults.filter((r) => r.success).length;
    const failCount = initResults.filter((r) => !r.success).length;
    logger?.info(
      {
        primaryProvider: options.provider,
        initialized: initResults.filter((r) => r.success).map((r) => r.provider),
        failed: initResults.filter((r) => !r.success).map((r) => r.provider),
        totalProviders: initResults.length,
        successCount,
        failCount,
      },
      `AI provider initialization complete: ${successCount}/${initResults.length} providers ready`,
    );

    if (successfulInstances.length === 0) {
      const failedProviders = initResults
        .filter((r) => !r.success)
        .map((r) => `${r.provider}: ${r.error}`)
        .join('; ');
      throw new Error(`No valid AI providers could be initialized. Failures: ${failedProviders}`);
    }

    return {
      aiModel: new ResilientAIAdapter(successfulInstances.map((i) => i.aiModel)),
      questionClassifier: new ResilientClassifierAdapter(
        successfulInstances.map((i) => i.questionClassifier),
      ),
      comprehensionEvaluator: new ResilientEvaluatorAdapter(
        successfulInstances.map((i) => i.comprehensionEvaluator),
      ),
      ragService: new ResilientRAGAdapter(successfulInstances.map((i) => i.ragService)),
    };
  }
}
