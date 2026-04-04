/**
 * Unit Tests for QuotaService
 *
 * Tests cover:
 * - Default quota initialization
 * - Quota consumption reduces remaining count
 * - Quota exhaustion blocks further calls
 * - Quota reset after expiry interval
 * - setQuota / getRemaining work correctly
 * - resetQuota restores default
 * - getMetrics returns correct data
 * - resetAll clears everything
 */

import { QuotaService } from '@/shared/ai/governance/quota-service.js';

describe('QuotaService', () => {
  let quotaService: QuotaService;
  const DEFAULT_QUOTA = 10;
  const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

  beforeEach(() => {
    quotaService = new QuotaService(DEFAULT_QUOTA, RESET_INTERVAL_MS);
  });

  describe('checkQuota', () => {
    it('should allow and return default quota for a new user', () => {
      const result = quotaService.checkQuota('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_QUOTA);
      expect(result.reason).toBeUndefined();
    });

    it('should allow and return correct remaining after consumption', () => {
      quotaService.consumeQuota('user-1');
      const result = quotaService.checkQuota('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_QUOTA - 1);
    });

    it('should block when quota is exhausted', () => {
      // Consume all quota
      for (let i = 0; i < DEFAULT_QUOTA; i++) {
        quotaService.consumeQuota('user-1');
      }

      const result = quotaService.checkQuota('user-1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toContain('quota exhausted');
    });

    it('should initialize different users independently', () => {
      quotaService.consumeQuota('user-1');
      quotaService.consumeQuota('user-1');

      const result1 = quotaService.checkQuota('user-1');
      const result2 = quotaService.checkQuota('user-2');

      expect(result1.remaining).toBe(DEFAULT_QUOTA - 2);
      expect(result2.remaining).toBe(DEFAULT_QUOTA);
    });
  });

  describe('consumeQuota', () => {
    it('should reduce remaining quota by 1', () => {
      quotaService.consumeQuota('user-1');
      const remaining = quotaService.getRemaining('user-1');

      expect(remaining).toBe(DEFAULT_QUOTA - 1);
    });

    it('should not go below zero', () => {
      for (let i = 0; i < DEFAULT_QUOTA + 5; i++) {
        quotaService.consumeQuota('user-1');
      }

      const remaining = quotaService.getRemaining('user-1');
      expect(remaining).toBe(0);
    });

    it('should return the remaining quota after consumption', () => {
      const remaining = quotaService.consumeQuota('user-1');

      expect(remaining).toBe(DEFAULT_QUOTA - 1);
    });

    it('should auto-initialize a new user on consume', () => {
      const remaining = quotaService.consumeQuota('new-user');

      expect(remaining).toBe(DEFAULT_QUOTA - 1);
    });
  });

  describe('setQuota', () => {
    it('should set a user quota explicitly', () => {
      quotaService.setQuota('user-1', 50);

      expect(quotaService.getRemaining('user-1')).toBe(50);
    });

    it('should clamp negative quota to 0', () => {
      quotaService.setQuota('user-1', -10);

      expect(quotaService.getRemaining('user-1')).toBe(0);
    });

    it('should initialize a new user with the set quota', () => {
      quotaService.setQuota('new-user', 25);

      expect(quotaService.getRemaining('new-user')).toBe(25);
    });
  });

  describe('getRemaining', () => {
    it('should return default quota for uninitialized user', () => {
      expect(quotaService.getRemaining('user-1')).toBe(DEFAULT_QUOTA);
    });

    it('should return updated quota after consumption', () => {
      quotaService.consumeQuota('user-1');
      quotaService.consumeQuota('user-1');

      expect(quotaService.getRemaining('user-1')).toBe(DEFAULT_QUOTA - 2);
    });

    it('should return 0 for exhausted quota', () => {
      for (let i = 0; i < DEFAULT_QUOTA; i++) {
        quotaService.consumeQuota('user-1');
      }

      expect(quotaService.getRemaining('user-1')).toBe(0);
    });
  });

  describe('resetQuota', () => {
    it('should restore quota to default', () => {
      quotaService.consumeQuota('user-1');
      quotaService.consumeQuota('user-1');
      quotaService.resetQuota('user-1');

      expect(quotaService.getRemaining('user-1')).toBe(DEFAULT_QUOTA);
    });

    it('should work for uninitialized users', () => {
      quotaService.resetQuota('new-user');

      expect(quotaService.getRemaining('new-user')).toBe(DEFAULT_QUOTA);
    });
  });

  describe('quota expiry and reset', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should reset quota after expiry interval', () => {
      // Consume some quota
      quotaService.consumeQuota('user-1');
      expect(quotaService.getRemaining('user-1')).toBe(DEFAULT_QUOTA - 1);

      // Advance past the reset interval
      jest.setSystemTime(Date.now() + RESET_INTERVAL_MS + 1);

      const result = quotaService.checkQuota('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_QUOTA);
    });

    it('should not reset quota before expiry', () => {
      quotaService.consumeQuota('user-1');

      // Advance to just before expiry
      jest.setSystemTime(Date.now() + RESET_INTERVAL_MS - 1000);

      const result = quotaService.checkQuota('user-1');
      expect(result.remaining).toBe(DEFAULT_QUOTA - 1);
    });

    it('should auto-reset on consume after expiry', () => {
      quotaService.consumeQuota('user-1');
      expect(quotaService.getRemaining('user-1')).toBe(DEFAULT_QUOTA - 1);

      // Advance past the reset interval
      jest.setSystemTime(Date.now() + RESET_INTERVAL_MS + 1);

      // consumeQuota should trigger reset
      const remaining = quotaService.consumeQuota('user-1');
      expect(remaining).toBe(DEFAULT_QUOTA - 1);
    });
  });

  describe('getMetrics', () => {
    it('should return empty object when no users exist', () => {
      const metrics = quotaService.getMetrics();

      expect(metrics).toEqual({});
    });

    it('should return metrics for all initialized users', () => {
      quotaService.consumeQuota('user-1');
      quotaService.consumeQuota('user-2');
      quotaService.consumeQuota('user-2');

      const metrics = quotaService.getMetrics();

      expect(metrics['user-1']).toBeDefined();
      expect(metrics['user-2']).toBeDefined();
      expect(metrics['user-1'].remaining).toBe(DEFAULT_QUOTA - 1);
      expect(metrics['user-2'].remaining).toBe(DEFAULT_QUOTA - 2);
    });

    it('should include resetInMs for each user', () => {
      quotaService.consumeQuota('user-1');

      const metrics = quotaService.getMetrics();
      const userMetrics = metrics['user-1'];

      expect(userMetrics.resetInMs).toBeGreaterThan(0);
      expect(userMetrics.resetInMs).toBeLessThanOrEqual(RESET_INTERVAL_MS);
    });
  });

  describe('resetAll', () => {
    it('should clear all user quotas', () => {
      quotaService.consumeQuota('user-1');
      quotaService.consumeQuota('user-2');
      quotaService.resetAll();

      const metrics = quotaService.getMetrics();
      expect(metrics).toEqual({});
    });

    it('should re-initialize users with default quota after resetAll', () => {
      quotaService.consumeQuota('user-1');
      quotaService.resetAll();

      // User should get default quota again on next access
      const result = quotaService.checkQuota('user-1');
      expect(result.remaining).toBe(DEFAULT_QUOTA);
    });
  });
});
