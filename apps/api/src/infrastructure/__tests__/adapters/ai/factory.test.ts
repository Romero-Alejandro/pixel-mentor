import { AIAdapterFactory } from '@/infrastructure/adapters/ai/ai-adapter-factory.js';
import {
  GeminiAIModelAdapter,
  GeminiClassifierAdapter,
  GeminiComprehensionEvaluatorAdapter,
  GeminiRAGServiceAdapter,
} from '@/infrastructure/adapters/ai/gemini/gemini-adapters.js';
import {
  OpenRouterAdapter,
  OpenRouterClassifierAdapter,
  OpenRouterComprehensionEvaluatorAdapter,
  OpenRouterRAGServiceAdapter,
} from '@/infrastructure/adapters/ai/open-router/openrouter-adapters.js';

jest.mock('@/infrastructure/adapters/ai/gemini/gemini-adapters.js', () => ({
  GeminiAIModelAdapter: jest.fn(() => ({})),
  GeminiClassifierAdapter: jest.fn(() => ({})),
  GeminiComprehensionEvaluatorAdapter: jest.fn(() => ({})),
  GeminiRAGServiceAdapter: jest.fn(() => ({})),
}));

jest.mock('@/infrastructure/adapters/ai/open-router/openrouter-adapters.js', () => ({
  OpenRouterAdapter: jest.fn(() => ({})),
  OpenRouterClassifierAdapter: jest.fn(() => ({})),
  OpenRouterComprehensionEvaluatorAdapter: jest.fn(() => ({})),
  OpenRouterRAGServiceAdapter: jest.fn(() => ({})),
}));

describe('AIAdapterFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create Gemini adapters when provider is gemini', () => {
    const options = {
      provider: 'gemini' as const,
      geminiApiKey: 'test-gemini-key',
      promptRepo: { getPrompt: jest.fn() },
      knowledgeChunkRepository: { findRelevantChunks: jest.fn() },
      logger: undefined,
    } as any;

    const adapters = AIAdapterFactory.create(options);

    expect(GeminiAIModelAdapter).toHaveBeenCalledWith(
      options.promptRepo,
      options.geminiApiKey,
      undefined,
    );
    expect(GeminiClassifierAdapter).toHaveBeenCalledWith(options.geminiApiKey, undefined);
    expect(GeminiComprehensionEvaluatorAdapter).toHaveBeenCalledWith(
      options.geminiApiKey,
      undefined,
    );
    expect(GeminiRAGServiceAdapter).toHaveBeenCalledWith(
      options.geminiApiKey,
      options.knowledgeChunkRepository,
    );

    expect(adapters.aiModel).toBeDefined();
    expect(adapters.questionClassifier).toBeDefined();
    expect(adapters.comprehensionEvaluator).toBeDefined();
    expect(adapters.ragService).toBeDefined();
  });

  it('should create OpenRouter adapters when provider is openrouter', () => {
    const options = {
      provider: 'openrouter' as const,
      openRouterApiKey: 'test-or-key',
      defaultModelOpenRouter: 'openai/gpt-4o',
      promptRepo: { getPrompt: jest.fn() },
      knowledgeChunkRepository: { findRelevantChunks: jest.fn() },
      logger: undefined,
    } as any;

    const adapters = AIAdapterFactory.create(options);

    expect(OpenRouterAdapter).toHaveBeenCalledWith(
      options.promptRepo,
      options.openRouterApiKey,
      undefined,
    );
    expect(OpenRouterClassifierAdapter).toHaveBeenCalledWith(
      options.openRouterApiKey,
      options.defaultModelOpenRouter,
      undefined,
    );
    expect(OpenRouterComprehensionEvaluatorAdapter).toHaveBeenCalledWith(
      options.openRouterApiKey,
      options.defaultModelOpenRouter,
      undefined,
    );
    expect(OpenRouterRAGServiceAdapter).toHaveBeenCalledWith(
      options.openRouterApiKey,
      options.knowledgeChunkRepository,
    );

    expect(adapters.aiModel).toBeDefined();
    expect(adapters.questionClassifier).toBeDefined();
    expect(adapters.comprehensionEvaluator).toBeDefined();
    expect(adapters.ragService).toBeDefined();
  });

  it('should throw error when OpenRouter apiKey is missing', () => {
    const options = {
      provider: 'openrouter' as const,
      openRouterApiKey: undefined,
      promptRepo: {},
      knowledgeChunkRepository: {},
    } as any;

    expect(() => AIAdapterFactory.create(options)).toThrow('OPENROUTER_API_KEY required');
  });

  it('should throw error when provider is unsupported', () => {
    const options = {
      provider: 'unknown' as any,
    } as any;

    expect(() => AIAdapterFactory.create(options)).toThrow('Unsupported LLM provider');
  });
});
