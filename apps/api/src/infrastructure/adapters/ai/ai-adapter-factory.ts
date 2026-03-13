import type pino from 'pino';

import type { AIService } from '@/domain/ports/ai-service.js';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
} from '@/domain/ports/question-classifier.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';
import type { KnowledgeChunkRepository } from '@/domain/ports/knowledge-chunk-repository.js';
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

export interface AIAdapterFactoryOptions {
  provider: 'gemini' | 'openrouter';
  geminiApiKey?: string;
  openRouterApiKey?: string;
  defaultModelOpenRouter?: string;
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
  createInstances(options: AIAdapterFactoryOptions): AIAdapterInstances;
}

class GeminiStrategy implements AIProviderStrategy {
  createInstances(options: AIAdapterFactoryOptions): AIAdapterInstances {
    if (!options.geminiApiKey) throw new Error('GEMINI_API_KEY required for Gemini');

    return {
      aiModel: new GeminiAIModelAdapter(options.promptRepo, options.geminiApiKey, options.logger),
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

class OpenRouterStrategy implements AIProviderStrategy {
  createInstances(options: AIAdapterFactoryOptions): AIAdapterInstances {
    if (!options.openRouterApiKey) throw new Error('OPENROUTER_API_KEY required for OpenRouter');

    const apiKey = options.openRouterApiKey;
    const model = options.defaultModelOpenRouter || 'openai/gpt-4o';

    return {
      aiModel: new OpenRouterAdapter(options.promptRepo, apiKey, options.logger),
      questionClassifier: new OpenRouterClassifierAdapter(apiKey, model, options.logger),
      comprehensionEvaluator: new OpenRouterComprehensionEvaluatorAdapter(
        apiKey,
        model,
        options.logger,
      ),
      ragService: new OpenRouterRAGServiceAdapter(apiKey, options.knowledgeChunkRepository),
    };
  }
}

const strategies: Record<string, AIProviderStrategy> = {
  gemini: new GeminiStrategy(),
  openrouter: new OpenRouterStrategy(),
};

export class AIAdapterFactory {
  static create(options: AIAdapterFactoryOptions): AIAdapterInstances {
    const strategy = strategies[options.provider];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${options.provider}`);
    }
    return strategy.createInstances(options);
  }
}
