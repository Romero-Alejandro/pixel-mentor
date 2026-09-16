// AI Service Provider - Centralized LLM provider management
export {
  initializeAIServices,
  getAIServices,
  isAIServicesInitialized,
  resetAIServices,
  type IAIServiceProvider,
  type ProviderHealthStatus,
} from '@/shared/ai/ai-service.provider.js';

// AI Adapter Factory - For creating provider-specific adapters
export {
  AIAdapterFactory,
  type AIAdapterFactoryOptions,
  type AIAdapterInstances,
} from '@/shared/ai/ai-adapter-factory.js';

// Client interface and error types
export {
  LLMError,
  type LLMErrorCode,
  type LLMExecutionOptions,
  type ILLMClient,
} from '@/shared/ai/client.interface.js';

// Base adapters
export { BaseLLMAdapter, BaseGenerativeAdapter } from '@/shared/ai/base-llm-adapter.js';

// Resilient adapters
export {
  ResilientAIAdapter,
  ResilientClassifierAdapter,
  ResilientEvaluatorAdapter,
  ResilientRAGAdapter,
} from '@/shared/ai/resilient-ai-adapter.js';

// Schemas
export * from '@/shared/ai/schemas.js';
