/**
 * OpenAI LLM Client Implementation
 * Provides a robust implementation of ILLMClient with retry logic and timeout handling.
 */

import OpenAI from 'openai';

import { LLMError } from './client.interface.js';
import type { ILLMClient, LLMExecutionOptions, BackoffStrategy } from './client.interface.js';

/**
 * Configuration options specific to the OpenAI client.
 */
export interface OpenAIClientConfig {
  /** OpenAI API key for authentication. */
  readonly apiKey: string;

  /**
   * Model identifier to use.
   * @default 'gpt-4o-mini'
   */
  readonly model?: string;

  /**
   * Base URL for the OpenAI API (useful for proxies or alternative endpoints).
   * @default 'https://api.openai.com/v1'
   */
  readonly baseURL?: string;

  /**
   * Temperature for response generation.
   * Lower values produce more deterministic outputs.
   * @default 0.2
   */
  readonly temperature?: number;

  /**
   * Maximum number of tokens in the response.
   * @default 2048
   */
  readonly maxTokens?: number;

  /**
   * Optional organization ID for OpenAI API.
   */
  readonly organization?: string;
}

/**
 * Default execution options.
 */
const DEFAULT_OPTIONS: Required<LLMExecutionOptions> = {
  maxAttempts: 3,
  timeoutMs: 30000,
  backoffStrategy: 'exponential',
  backoffFactor: 2,
};

/**
 * HTTP status codes that indicate a rate limit error.
 */
const RATE_LIMIT_STATUS_CODES = new Set([429]);

/**
 * HTTP status codes that indicate transient errors that may succeed on retry.
 */
const TRANSIENT_STATUS_CODES = new Set([500, 502, 503, 504]);

/**
 * OpenAI implementation of the LLM client interface.
 * Implements retry logic with exponential backoff and timeout handling via AbortController.
 */
export class OpenAIClient implements ILLMClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  /**
   * Creates a new OpenAI LLM client instance.
   *
   * @param config - Configuration options for the client
   */
  constructor(config: OpenAIClientConfig) {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
    });

    this.model = config.model ?? 'gpt-4o-mini';
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  /**
   * Executes a prompt against the OpenAI API with retry logic and timeout handling.
   *
   * @param prompt - The prompt to send to the LLM
   * @param options - Optional execution configuration
   * @returns The LLM's response text
   * @throws {LLMError} When all retry attempts fail
   */
  async executePrompt(prompt: string, options?: LLMExecutionOptions): Promise<string> {
    const opts = this.mergeOptions(options);
    let lastError: unknown;
    let lastPartialResponse: string | undefined;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const response = await this.executeWithTimeout(prompt, opts.timeoutMs, attempt);
        return response;
      } catch (error: unknown) {
        lastError = error;
        lastPartialResponse = this.extractPartialResponse(error);

        // Check if we should abort (non-retryable errors)
        if (error instanceof LLMError && !error.isRetryable) {
          throw error;
        }

        // Check if we've exhausted retries
        if (attempt < opts.maxAttempts) {
          const delay = this.calculateBackoffDelay(
            opts.backoffStrategy,
            opts.backoffFactor,
            attempt,
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw this.createFinalError(lastError, opts.maxAttempts, lastPartialResponse);
  }

  /**
   * Executes the API call with timeout handling.
   *
   * @param prompt - The prompt to send
   * @param timeoutMs - Timeout in milliseconds
   * @param attempt - Current attempt number (for error context)
   * @returns The response text
   */
  private async executeWithTimeout(
    prompt: string,
    timeoutMs: number,
    attempt: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        },
        {
          signal: controller.signal as AbortSignal,
        },
      );

      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw LLMError.apiError('Empty response received from OpenAI', undefined, attempt);
      }

      return content;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      throw this.mapError(error, attempt);
    }
  }

  /**
   * Maps various error types to LLMError instances.
   *
   * @param error - The original error
   * @param attempt - Current attempt number
   * @returns A properly typed LLMError
   */
  private mapError(error: unknown, attempt: number): LLMError {
    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return LLMError.timeout(0, attempt);
    }

    // Handle OpenAI SDK errors
    if (this.isOpenAIError(error)) {
      const status = error.status;
      const message = error.message || 'Unknown OpenAI error';

      if (status === 401) {
        return LLMError.authentication(message);
      }

      if (RATE_LIMIT_STATUS_CODES.has(status)) {
        return LLMError.rateLimited(error, attempt);
      }

      if (TRANSIENT_STATUS_CODES.has(status)) {
        return new LLMError({
          message,
          code: 'TRANSIENT_ERROR',
          originalError: error,
          attemptsMade: attempt,
        });
      }

      return LLMError.modelError(message, error);
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return LLMError.apiError(`Network error: ${error.message}`, error, attempt);
    }

    // Unknown errors
    if (error instanceof Error) {
      return LLMError.apiError(error.message, error, attempt);
    }

    return LLMError.apiError('Unknown error occurred', error, attempt);
  }

  /**
   * Type guard to check if an error is an OpenAI API error.
   */
  private isOpenAIError(error: unknown): error is { status: number; message?: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as Record<string, unknown>).status === 'number'
    );
  }

  /**
   * Extracts partial response from an error if available.
   */
  private extractPartialResponse(error: unknown): string | undefined {
    if (
      this.isOpenAIError(error) &&
      'response' in error &&
      typeof (error as Record<string, unknown>).response === 'object'
    ) {
      const response = (error as Record<string, unknown>).response as Record<string, unknown>;
      if ('choices' in response && Array.isArray(response.choices)) {
        const choices = response.choices as Array<Record<string, unknown>>;
        if (choices.length > 0 && 'message' in choices[0]) {
          const message = choices[0].message as Record<string, unknown>;
          if (typeof message.content === 'string') {
            return message.content;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Calculates the delay before the next retry attempt.
   *
   * @param strategy - The backoff strategy to use
   * @param factor - The backoff multiplier
   * @param attempt - The current attempt number (1-indexed)
   * @returns The delay in milliseconds
   */
  private calculateBackoffDelay(
    strategy: BackoffStrategy,
    factor: number,
    attempt: number,
  ): number {
    const baseDelay = 1000; // 1 second base delay

    switch (strategy) {
      case 'exponential':
        return baseDelay * Math.pow(factor, attempt - 1);
      case 'linear':
        return baseDelay * attempt * factor;
      case 'fixed':
      default:
        return baseDelay * factor;
    }
  }

  /**
   * Creates the final error to throw when all retries are exhausted.
   */
  private createFinalError(error: unknown, attempts: number, partialResponse?: string): LLMError {
    if (error instanceof LLMError) {
      return new LLMError({
        message: error.message,
        code: error.code,
        originalError: error.originalError,
        attemptsMade: attempts,
        partialResponse,
      });
    }

    const message = error instanceof Error ? error.message : 'All retry attempts failed';
    return new LLMError({
      message,
      code: 'API_ERROR',
      originalError: error,
      attemptsMade: attempts,
      partialResponse,
    });
  }

  /**
   * Merges user options with defaults.
   */
  private mergeOptions(options?: LLMExecutionOptions): Required<LLMExecutionOptions> {
    return {
      maxAttempts: options?.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts,
      timeoutMs: options?.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs,
      backoffStrategy: options?.backoffStrategy ?? DEFAULT_OPTIONS.backoffStrategy,
      backoffFactor: options?.backoffFactor ?? DEFAULT_OPTIONS.backoffFactor,
    };
  }

  /**
   * Sleep utility for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create an OpenAI client from environment variables.
 *
 * @param overrides - Optional configuration overrides
 * @returns A configured OpenAI client instance
 */
export function createOpenAIClient(overrides?: Partial<OpenAIClientConfig>): OpenAIClient {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAIClient({
    apiKey,
    model: overrides?.model ?? process.env.OPENAI_MODEL,
    baseURL: overrides?.baseURL ?? process.env.OPENAI_BASE_URL,
    temperature: overrides?.temperature,
    maxTokens: overrides?.maxTokens,
    organization: overrides?.organization ?? process.env.OPENAI_ORGANIZATION,
  });
}
