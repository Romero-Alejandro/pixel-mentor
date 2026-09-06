/**
 * SSE Retry Utilities
 *
 * Provides exponential backoff with jitter for SSE reconnection,
 * retryable error classification, and configurable retry constants.
 *
 * Why jitter? Without it, all clients experiencing the same outage
 * retry at the same time (thundering herd). Jitter spreads retries
 * across a time window, reducing server load spikes.
 */

// ---- Constants ----

export const SSE_RETRY_DEFAULTS: SSERetryConfig = {
  /** Maximum number of retry attempts before giving up */
  maxRetries: 5,
  /** Base delay in ms (first retry) */
  baseDelayMs: 1_000,
  /** Maximum delay cap in ms */
  maxDelayMs: 15_000,
  /** Jitter factor: 0 = no jitter, 1 = full jitter (0-100% of computed delay) */
  jitterFactor: 0.3,
};

// ---- Types ----

export interface SSERetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

export type RetryableErrorType =
  | 'network' // fetch failed, connection refused
  | 'timeout' // request timed out
  | 'server' // 5xx status codes
  | 'rate-limit' // 429 Too Many Requests
  | 'dedup' // 409 Conflict — duplicate request in progress
  | 'unknown'; // unknown, treated as retryable

// ---- Pure Functions ----

/**
 * Calculate exponential backoff delay with jitter.
 *
 * Formula: min(base * 2^attempt, max) * (1 + random * jitter)
 *
 * Examples with defaults (base=1000, max=15000, jitter=0.3):
 *   attempt 0: ~1000ms  (700-1300)
 *   attempt 1: ~2000ms  (1400-2600)
 *   attempt 2: ~4000ms  (2800-5200)
 *   attempt 3: ~8000ms  (5600-10400)
 *   attempt 4: ~15000ms (10500-15000, capped)
 */
export function calculateBackoffDelay(
  attempt: number,
  config: SSERetryConfig = SSE_RETRY_DEFAULTS,
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = 1 + (Math.random() * 2 - 1) * config.jitterFactor; // [1-jitter, 1+jitter]
  return Math.round(cappedDelay * jitter);
}

/**
 * Classify an error as retryable or not.
 *
 * Retryable: network errors, timeouts, 5xx, 429
 * Non-retryable: 4xx (except 429), auth errors, abort
 */
export function classifySSEError(error: unknown): {
  retryable: boolean;
  type: RetryableErrorType;
  statusCode?: number;
} {
  // AbortError — client cancelled, never retry
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { retryable: false, type: 'unknown' };
  }

  // TypeError from fetch — network failure
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('load') ||
      msg.includes('cors')
    ) {
      return { retryable: true, type: 'network' };
    }
    return { retryable: true, type: 'network' };
  }

  // Error with status code
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    if (status === 429) return { retryable: true, type: 'rate-limit', statusCode: status };
    if (status === 409) return { retryable: true, type: 'dedup', statusCode: status };
    if (status >= 500) return { retryable: true, type: 'server', statusCode: status };
    if (status >= 400 && status < 500)
      return { retryable: false, type: 'unknown', statusCode: status };
  }

  // Response object
  if (error instanceof Response) {
    if (error.status === 429)
      return { retryable: true, type: 'rate-limit', statusCode: error.status };
    if (error.status === 409) return { retryable: true, type: 'dedup', statusCode: error.status };
    if (error.status >= 500) return { retryable: true, type: 'server', statusCode: error.status };
    if (error.status >= 400 && error.status < 500)
      return { retryable: false, type: 'unknown', statusCode: error.status };
  }

  // Timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return { retryable: true, type: 'timeout' };
    }
    if (msg.includes('network') || msg.includes('econnreset') || msg.includes('econnrefused')) {
      return { retryable: true, type: 'network' };
    }
  }

  // Unknown — treat as retryable (conservative)
  return { retryable: true, type: 'unknown' };
}

/**
 * Build a user-friendly message for retry status.
 */
export function getRetryMessage(attempt: number, maxRetries: number, delayMs: number): string {
  if (attempt >= maxRetries) {
    return 'Se agotaron los reintentos. Verifica tu conexion e intenta de nuevo.';
  }
  return `Reconectando... (intento ${attempt + 1}/${maxRetries}, espera ${Math.round(delayMs / 1000)}s)`;
}
