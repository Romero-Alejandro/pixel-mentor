/**
 * LLM Client Module
 * Exports the interface and OpenAI implementation for LLM communication.
 */

export {
  LLMError,
  type ILLMClient,
  type LLMExecutionOptions,
  type BackoffStrategy,
  type LLMErrorCode,
} from './client.interface.js';

export { OpenAIClient, createOpenAIClient, type OpenAIClientConfig } from './openai.client.js';
