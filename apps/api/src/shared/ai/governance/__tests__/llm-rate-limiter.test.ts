/**
 * Unit Tests for LLMRateLimiter
 *
 * Tests cover:
 * - Allows requests within limit
 * - Blocks after max requests
 * - retryAfterMs calculated correctly
 * - Sliding window expires old requests
 * - getRequestCount returns correct count
 * - getMetrics returns correct data
 * - resetAll clears everything
 */

import { LLMRateLimiter } from '@/shared/ai/governance/llm-rate-limiter.js';

describe('LLMRateLimiter', () => {
  let rateLimiter: LLMRateLimiter;
  const MAX_REQUESTS = 5;
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour

  beforeEach(() => {
    rateLimiter = new LLMRateLimiter(MAX_REQUESTS, WINDOW_MS);
  });

  describe('check', () => {
    it('should allow a new user with full remaining', () => {
      const result = rateLimiter.check('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(MAX_REQUESTS);
    });

    it('should allow requests within the limit', () => {
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-1');

      const result = rateLimiter.check('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(MAX_REQUESTS - 2);
    });

    it('should block after max requests', () => {
      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter.recordRequest('user-1');
      }

      const result = rateLimiter.check('user-1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should include retryAfterMs when blocked', () => {
      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter.recordRequest('user-1');
      }

      const result = rateLimiter.check('user-1');

      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(WINDOW_MS);
    });
  });

  describe('recordRequest', () => {
    it('should track a request for a user', () => {
      rateLimiter.recordRequest('user-1');

      const count = rateLimiter.getRequestCount('user-1');
      expect(count).toBe(1);
    });

    it('should track multiple requests for the same user', () => {
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-1');

      const count = rateLimiter.getRequestCount('user-1');
      expect(count).toBe(3);
    });

    it('should track requests for different users independently', () => {
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-2');

      expect(rateLimiter.getRequestCount('user-1')).toBe(2);
      expect(rateLimiter.getRequestCount('user-2')).toBe(1);
    });
  });

  describe('getRequestCount', () => {
    it('should return 0 for a user with no requests', () => {
      expect(rateLimiter.getRequestCount('user-1')).toBe(0);
    });

    it('should return correct count after recording requests', () => {
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest('user-1');
      }

      expect(rateLimiter.getRequestCount('user-1')).toBe(3);
    });
  });

  describe('sliding window expiry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire old requests after the window passes', () => {
      // Record requests
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-1');

      // Advance past the window
      jest.setSystemTime(Date.now() + WINDOW_MS + 1);

      // Old requests should be expired
      const count = rateLimiter.getRequestCount('user-1');
      expect(count).toBe(0);
    });

    it('should allow requests again after window expires', () => {
      // Fill up the rate limit
      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter.recordRequest('user-1');
      }

      // Verify blocked
      expect(rateLimiter.check('user-1').allowed).toBe(false);

      // Advance past the window
      jest.setSystemTime(Date.now() + WINDOW_MS + 1);

      // Should be allowed again
      const result = rateLimiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(MAX_REQUESTS);
    });

    it('should only expire requests older than the window', () => {
      // Record a request at time 0
      rateLimiter.recordRequest('user-1');

      // Advance halfway through the window
      jest.setSystemTime(Date.now() + WINDOW_MS / 2);

      // Record another request
      rateLimiter.recordRequest('user-1');

      // Advance past the first request's window but not the second's
      jest.setSystemTime(Date.now() + WINDOW_MS / 2 + 1);

      // First request should be expired, second should remain
      const count = rateLimiter.getRequestCount('user-1');
      expect(count).toBe(1);
    });

    it('should calculate correct retryAfterMs based on oldest request', () => {
      // Record first request
      rateLimiter.recordRequest('user-1');

      // Wait 10 seconds
      jest.setSystemTime(Date.now() + 10_000);

      // Fill up remaining requests
      for (let i = 1; i < MAX_REQUESTS; i++) {
        rateLimiter.recordRequest('user-1');
      }

      const result = rateLimiter.check('user-1');

      // retryAfterMs should be approximately WINDOW_MS - 10_000
      expect(result.retryAfterMs).toBeGreaterThan(WINDOW_MS - 15_000);
      expect(result.retryAfterMs).toBeLessThanOrEqual(WINDOW_MS);
    });

    it('should return 0 for retryAfterMs if oldest request just expired', () => {
      rateLimiter.recordRequest('user-1');

      for (let i = 1; i < MAX_REQUESTS; i++) {
        rateLimiter.recordRequest('user-1');
      }

      // Advance past the window
      jest.setSystemTime(Date.now() + WINDOW_MS + 1);

      const result = rateLimiter.check('user-1');
      // After cleanup, all requests are expired, so user is allowed
      expect(result.allowed).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return empty object when no users exist', () => {
      const metrics = rateLimiter.getMetrics();

      expect(metrics).toEqual({});
    });

    it('should return metrics for all tracked users', () => {
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-2');

      const metrics = rateLimiter.getMetrics();

      expect(metrics['user-1']).toBeDefined();
      expect(metrics['user-2']).toBeDefined();
      expect(metrics['user-1'].requests).toBe(2);
      expect(metrics['user-1'].remaining).toBe(MAX_REQUESTS - 2);
      expect(metrics['user-2'].requests).toBe(1);
      expect(metrics['user-2'].remaining).toBe(MAX_REQUESTS - 1);
    });

    it('should not return negative remaining', () => {
      for (let i = 0; i < MAX_REQUESTS + 5; i++) {
        rateLimiter.recordRequest('user-1');
      }

      const metrics = rateLimiter.getMetrics();

      expect(metrics['user-1'].remaining).toBe(0);
    });
  });

  describe('resetAll', () => {
    it('should clear all rate limit data', () => {
      rateLimiter.recordRequest('user-1');
      rateLimiter.recordRequest('user-2');
      rateLimiter.resetAll();

      const metrics = rateLimiter.getMetrics();
      expect(metrics).toEqual({});
    });

    it('should allow requests again after reset', () => {
      for (let i = 0; i < MAX_REQUESTS; i++) {
        rateLimiter.recordRequest('user-1');
      }

      rateLimiter.resetAll();

      const result = rateLimiter.check('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(MAX_REQUESTS);
    });
  });
});
