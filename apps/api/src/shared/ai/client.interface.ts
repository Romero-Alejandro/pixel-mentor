/**
 * LLM Client Module
 * Provides a clean abstraction for LLM communication with retry logic and error handling.
 */

/**
 * Configuration options for LLM execution.
 */
export interface LLMExecutionOptions {
  /**
   * Maximum number of retry attempts on failure.
   * @default 3
   */
  readonly maxAttempts?: number;

  /**
   * Timeout in milliseconds for each attempt.
   * @default 30000
   */
  readonly timeoutMs?: number;

  /**
   * Backoff strategy for retries.
   * @default 'exponential'
   */
  readonly backoffStrategy?: BackoffStrategy;

  /**
   * Multiplier for exponential backoff calculation.
   * @default 2
   */
  readonly backoffFactor?: number;
}

/**
 * Supported backoff strategies for retry logic.
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Error class for LLM-related failures.
 * Provides structured error information for debugging and error handling.
 */
export class LLMError extends Error {
  /** Error code for programmatic error handling. */
  readonly code: LLMErrorCode;

  /** The original error that caused this LLM error, if any. */
  readonly originalError?: unknown;

  /** Number of attempts made before the error occurred. */
  readonly attemptsMade: number;

  /** Optional partial response received before failure. */
  readonly partialResponse?: string;

  constructor(params: LLMErrorParams) {
    super(params.message);
    this.name = 'LLMError';
    this.code = params.code;
    this.originalError = params.originalError;
    this.attemptsMade = params.attemptsMade;
    this.partialResponse = params.partialResponse;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMError);
    }
  }

  /**
   * Creates a timeout error.
   */
  static timeout(timeoutMs: number, attemptsMade: number): LLMError {
    return new LLMError({
      message: `LLM request timed out after ${timeoutMs}ms`,
      code: 'TIMEOUT',
      attemptsMade,
    });
  }

  /**
   * Creates a rate limit error.
   */
  static rateLimited(originalError?: unknown, attemptsMade?: number): LLMError {
    return new LLMError({
      message: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      originalError,
      attemptsMade: attemptsMade ?? 1,
    });
  }

  /**
   * Creates an authentication error.
   */
  static authentication(message?: string): LLMError {
    return new LLMError({
      message: message ?? 'Authentication failed',
      code: 'AUTHENTICATION_ERROR',
      attemptsMade: 1,
    });
  }

  /**
   * Creates a model error (e.g., model not found, invalid request).
   */
  static modelError(message: string, originalError?: unknown): LLMError {
    return new LLMError({
      message,
      code: 'MODEL_ERROR',
      originalError,
      attemptsMade: 1,
    });
  }

  /**
   * Creates a generic API error.
   */
  static apiError(message: string, originalError?: unknown, attemptsMade?: number): LLMError {
    return new LLMError({
      message,
      code: 'API_ERROR',
      originalError,
      attemptsMade: attemptsMade ?? 1,
    });
  }

  /**
   * Creates an abort error (e.g., user cancelled the request).
   */
  static aborted(originalError?: unknown): LLMError {
    return new LLMError({
      message: 'Request was aborted',
      code: 'ABORTED',
      originalError,
      attemptsMade: 1,
    });
  }

  /**
   * Checks if the error is retryable (rate limit or transient errors).
   */
  get isRetryable(): boolean {
    return (
      this.code === 'RATE_LIMITED' || this.code === 'TIMEOUT' || this.code === 'TRANSIENT_ERROR'
    );
  }
}

/**
 * Parameters for constructing an LLMError.
 */
interface LLMErrorParams {
  readonly message: string;
  readonly code: LLMErrorCode;
  readonly originalError?: unknown;
  readonly attemptsMade: number;
  readonly partialResponse?: string;
}

/**
 * Error codes for LLM-related errors.
 */
export type LLMErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'AUTHENTICATION_ERROR'
  | 'MODEL_ERROR'
  | 'API_ERROR'
  | 'ABORTED'
  | 'TRANSIENT_ERROR';

/**
 * Abstract interface for LLM client implementations.
 * Follows Dependency Inversion principle - depends on abstraction, not concrete implementation.
 */
export interface ILLMClient {
  /**
   * Executes a prompt against the LLM and returns the response text.
   *
   * @param prompt - The prompt string to send to the LLM
   * @param options - Optional execution configuration
   * @returns The LLM's response as a string
   * @throws {LLMError} When the request fails after all retry attempts
   */
  executePrompt(prompt: string, options?: LLMExecutionOptions): Promise<string>;
}
