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

export interface AIAdapterFactoryOptions {
  provider: 'gemini' | 'openrouter' | 'groq';
  geminiApiKey?: string;
  openRouterApiKey?: string;
  groqApiKey?: string;
  defaultModelGemini?: string;
  defaultModelOpenRouter?: string;
  defaultModelGroq?: string;
  promptRepo: PromptRepository;
  knowledgeChunkRepository: KnowledgeChunkRepository;
  logger?: pino.Logger;
}

export interface AIAdapterInstances {
  aiModel: AIService;
  questionClassifier: QuestionClassifier;
  comprehensionEvaluator: ComprehensionEvaluator;
  ragService: RAGService;
}

interface AIProviderStrategy {
  create(options: AIAdapterFactoryOptions): AIAdapterInstances;
}

class GeminiStrategy implements AIProviderStrategy {
  create(options: AIAdapterFactoryOptions): AIAdapterInstances {
    if (!options.geminiApiKey) throw new Error('GEMINI_API_KEY required');
    const model = options.defaultModelGemini || 'gemini-3.1-flash-lite';
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
    if (!options.groqApiKey) throw new Error('GROQ_API_KEY required');
    const model = options.defaultModelGroq || 'moonshotai/kimi-k2-instruct-0905';
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
    if (!options.openRouterApiKey) throw new Error('OPENROUTER_API_KEY required');
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

export class AIAdapterFactory {
  private static readonly strategies: Record<string, AIProviderStrategy> = {
    gemini: new GeminiStrategy(),
    groq: new GroqStrategy(),
    openrouter: new OpenRouterStrategy(),
  };

  static createResilient(options: AIAdapterFactoryOptions): AIAdapterInstances {
    const availableProviders: ('gemini' | 'openrouter' | 'groq')[] = [
      'gemini',
      'groq',
      'openrouter',
    ];

    const orderedProviders = [
      options.provider,
      ...availableProviders.filter((p) => p !== options.provider),
    ];

    const instances = orderedProviders
      .map((provider) => {
        try {
          return this.strategies[provider].create(options);
        } catch {
          return null;
        }
      })
      .filter((instance): instance is AIAdapterInstances => instance !== null);

    if (instances.length === 0) {
      throw new Error('No valid AI providers could be initialized');
    }

    return {
      aiModel: new ResilientAIAdapter(instances.map((i) => i.aiModel)),
      questionClassifier: new ResilientClassifierAdapter(
        instances.map((i) => i.questionClassifier),
      ),
      comprehensionEvaluator: new ResilientEvaluatorAdapter(
        instances.map((i) => i.comprehensionEvaluator),
      ),
      ragService: new ResilientRAGAdapter(instances.map((i) => i.ragService)),
    };
  }
}
