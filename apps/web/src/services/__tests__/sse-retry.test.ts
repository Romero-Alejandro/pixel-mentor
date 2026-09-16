/**
 * SSE Retry Utilities Tests
 *
 * Tests for exponential backoff with jitter, retryable error classification,
 * and retry message generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  SSE_RETRY_DEFAULTS,
  calculateBackoffDelay,
  classifySSEError,
  getRetryMessage,
  type SSERetryConfig,
} from '@/services/sse-retry';

describe('SSE Retry Utilities', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- calculateBackoffDelay ----

  describe('calculateBackoffDelay', () => {
    it('should return approximately baseDelay for attempt 0', () => {
      // With jitter=0.3, delay should be in [700, 1300] range
      for (let i = 0; i < 20; i++) {
        const delay = calculateBackoffDelay(0);
        expect(delay).toBeGreaterThanOrEqual(700);
        expect(delay).toBeLessThanOrEqual(1300);
      }
    });

    it('should approximately double each attempt', () => {
      // With jitter=0, we can test exact doubling
      const noJitter: SSERetryConfig = { ...SSE_RETRY_DEFAULTS, jitterFactor: 0 };
      expect(calculateBackoffDelay(0, noJitter)).toBe(1000);
      expect(calculateBackoffDelay(1, noJitter)).toBe(2000);
      expect(calculateBackoffDelay(2, noJitter)).toBe(4000);
      expect(calculateBackoffDelay(3, noJitter)).toBe(8000);
      expect(calculateBackoffDelay(4, noJitter)).toBe(15000); // capped at maxDelay
    });

    it('should cap at maxDelayMs', () => {
      const noJitter: SSERetryConfig = { ...SSE_RETRY_DEFAULTS, jitterFactor: 0 };
      // Even with very high attempt, should not exceed maxDelay
      expect(calculateBackoffDelay(100, noJitter)).toBe(15000);
    });

    it('should apply jitter within configured range', () => {
      const config: SSERetryConfig = { ...SSE_RETRY_DEFAULTS, jitterFactor: 0.5 };

      // Mock Math.random to return known values
      vi.mocked(Math.random).mockReturnValue(0.5); // no jitter (1 + 0 * 0.5 = 1)
      expect(calculateBackoffDelay(0, config)).toBe(1000);

      vi.mocked(Math.random).mockReturnValue(0); // minimum jitter (1 + (-1) * 0.5 = 0.5)
      expect(calculateBackoffDelay(0, config)).toBe(500);

      vi.mocked(Math.random).mockReturnValue(1); // maximum jitter (1 + (1) * 0.5 = 1.5)
      expect(calculateBackoffDelay(0, config)).toBe(1500);
    });

    it('should return integer values', () => {
      for (let i = 0; i < 10; i++) {
        const delay = calculateBackoffDelay(i);
        expect(Number.isInteger(delay)).toBe(true);
      }
    });

    it('should work with custom config', () => {
      const custom: SSERetryConfig = {
        maxRetries: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        jitterFactor: 0,
      };
      expect(calculateBackoffDelay(0, custom)).toBe(500);
      expect(calculateBackoffDelay(1, custom)).toBe(1000);
      expect(calculateBackoffDelay(2, custom)).toBe(2000);
      expect(calculateBackoffDelay(3, custom)).toBe(4000);
      expect(calculateBackoffDelay(4, custom)).toBe(5000); // capped
    });
  });

  // ---- classifySSEError ----

  describe('classifySSEError', () => {
    it('should classify AbortError as non-retryable', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      const result = classifySSEError(error);
      expect(result.retryable).toBe(false);
      expect(result.type).toBe('unknown');
    });

    it('should classify TypeError (network) as retryable', () => {
      const error = new TypeError('Failed to fetch');
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('network');
    });

    it('should classify TypeError (CORS) as retryable', () => {
      const error = new TypeError('NetworkError when attempting to fetch resource');
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('network');
    });

    it('should classify 429 as retryable rate-limit', () => {
      const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('rate-limit');
      expect(result.statusCode).toBe(429);
    });

    it('should classify 5xx as retryable server error', () => {
      const error = Object.assign(new Error('Internal Server Error'), { status: 500 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('server');
      expect(result.statusCode).toBe(500);
    });

    it('should classify 502 as retryable server error', () => {
      const error = Object.assign(new Error('Bad Gateway'), { status: 502 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('server');
      expect(result.statusCode).toBe(502);
    });

    it('should classify 503 as retryable server error', () => {
      const error = Object.assign(new Error('Service Unavailable'), { status: 503 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('server');
      expect(result.statusCode).toBe(503);
    });

    it('should classify 409 as retryable dedup error', () => {
      const error = Object.assign(new Error('Conflict'), { status: 409 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('dedup');
      expect(result.statusCode).toBe(409);
    });

    it('should classify 400 as non-retryable client error', () => {
      const error = Object.assign(new Error('Bad Request'), { status: 400 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should classify 401 as non-retryable auth error', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should classify 403 as non-retryable forbidden error', () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 });
      const result = classifySSEError(error);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it('should classify Response objects with 429 as retryable', () => {
      const response = new Response(null, { status: 429 });
      const result = classifySSEError(response);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('rate-limit');
      expect(result.statusCode).toBe(429);
    });

    it('should classify Response objects with 500 as retryable', () => {
      const response = new Response(null, { status: 500 });
      const result = classifySSEError(response);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('server');
      expect(result.statusCode).toBe(500);
    });

    it('should classify Response objects with 400 as non-retryable', () => {
      const response = new Response(null, { status: 400 });
      const result = classifySSEError(response);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should classify timeout errors as retryable', () => {
      const error = new Error('Request timed out');
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('timeout');
    });

    it('should classify ECONNRESET as retryable network error', () => {
      const error = new Error('read ECONNRESET');
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('network');
    });

    it('should classify unknown errors as retryable (conservative)', () => {
      const error = new Error('Something weird happened');
      const result = classifySSEError(error);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('unknown');
    });

    it('should classify non-Error values as retryable', () => {
      const result = classifySSEError('string error');
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('unknown');
    });

    it('should classify null as retryable', () => {
      const result = classifySSEError(null);
      expect(result.retryable).toBe(true);
      expect(result.type).toBe('unknown');
    });
  });

  // ---- getRetryMessage ----

  describe('getRetryMessage', () => {
    it('should return retry in progress message', () => {
      const msg = getRetryMessage(1, 5, 1000);
      expect(msg).toContain('2/5');
      expect(msg).toContain('1s');
    });

    it('should return retry in progress message for later attempts', () => {
      const msg = getRetryMessage(3, 5, 4000);
      expect(msg).toContain('4/5');
      expect(msg).toContain('4s');
    });

    it('should return exhausted message when max retries reached', () => {
      const msg = getRetryMessage(5, 5, 15000);
      expect(msg).toContain('agotaron');
      expect(msg).toContain('reintentos');
    });

    it('should round delay seconds', () => {
      const msg = getRetryMessage(1, 5, 1500);
      expect(msg).toContain('2s'); // 1500ms rounds to 2s
    });
  });

  // ---- SSE_RETRY_DEFAULTS ----

  describe('SSE_RETRY_DEFAULTS', () => {
    it('should have sensible defaults', () => {
      expect(SSE_RETRY_DEFAULTS.maxRetries).toBe(5);
      expect(SSE_RETRY_DEFAULTS.baseDelayMs).toBe(1000);
      expect(SSE_RETRY_DEFAULTS.maxDelayMs).toBe(15000);
      expect(SSE_RETRY_DEFAULTS.jitterFactor).toBe(0.3);
    });

    it('should have maxRetries > 0', () => {
      expect(SSE_RETRY_DEFAULTS.maxRetries).toBeGreaterThan(0);
    });

    it('should have maxDelayMs >= baseDelayMs', () => {
      expect(SSE_RETRY_DEFAULTS.maxDelayMs).toBeGreaterThanOrEqual(SSE_RETRY_DEFAULTS.baseDelayMs);
    });

    it('should have jitterFactor between 0 and 1', () => {
      expect(SSE_RETRY_DEFAULTS.jitterFactor).toBeGreaterThanOrEqual(0);
      expect(SSE_RETRY_DEFAULTS.jitterFactor).toBeLessThanOrEqual(1);
    });
  });
});
