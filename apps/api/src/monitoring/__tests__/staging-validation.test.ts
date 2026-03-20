/**
 * Unit Tests for Staging Validation Module
 */

import {
  validateDependencies,
  logNewEvaluatorEngineBanner,
  getEvaluationHealthCheck,
} from '../staging-validation';

// ============================================================
// Test Setup
// ============================================================

describe('Staging Validation', () => {
  // ============================================================
  // Dependency Validation Tests
  // ============================================================

  describe('validateDependencies', () => {
    it('should return valid result when no feature flag service provided', () => {
      const result = validateDependencies();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toContain(
        'FeatureFlagService not provided - cohort-based routing disabled',
      );
    });

    it('should return warnings when cohorts are configured', () => {
      const mockFeatureFlagService = {
        getCohorts: () => ['beta-users', 'premium-users'],
      };

      const result = validateDependencies(mockFeatureFlagService as any);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.some((w) => w.includes('beta-users'))).toBe(true);
    });
  });

  // ============================================================
  // Banner Tests
  // ============================================================

  describe('logNewEvaluatorEngineBanner', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.USE_NEW_EVALUATOR_ENGINE;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should not log banner when env var is not set', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logNewEvaluatorEngineBanner();

      // Should not have logged the banner
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🚀 NEW EVALUATOR ENGINE ACTIVE'),
      );
      consoleSpy.mockRestore();
    });

    it('should log banner when env var is "true"', () => {
      process.env.USE_NEW_EVALUATOR_ENGINE = 'true';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logNewEvaluatorEngineBanner();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 NEW EVALUATOR ENGINE ACTIVE'),
      );
      consoleSpy.mockRestore();
    });

    it('should log banner when env var is "1"', () => {
      process.env.USE_NEW_EVALUATOR_ENGINE = '1';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logNewEvaluatorEngineBanner();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 NEW EVALUATOR ENGINE ACTIVE'),
      );
      consoleSpy.mockRestore();
    });
  });

  // ============================================================
  // Health Check Tests
  // ============================================================

  describe('getEvaluationHealthCheck', () => {
    it('should return healthy check when no feature flag service', () => {
      const result = getEvaluationHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.engineActive).toBe(false);
      expect(result.configuredCohorts).toEqual([]);
    });

    it('should detect new engine active via env var', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, USE_NEW_EVALUATOR_ENGINE: 'true' };

      const result = getEvaluationHealthCheck();

      expect(result.engineActive).toBe(true);
      expect(result.useNewEngine).toBe(true);

      process.env = originalEnv;
    });

    it('should detect new engine from feature flag config', () => {
      const mockFeatureFlagService = {
        getConfig: () => ({ useNewEvaluatorEngine: true }),
        getCohorts: () => [],
      };

      const result = getEvaluationHealthCheck(mockFeatureFlagService as any);

      expect(result.engineActive).toBe(true);
    });

    it('should include configured cohorts', () => {
      const mockFeatureFlagService = {
        getConfig: () => ({ useNewEvaluatorEngine: false }),
        getCohorts: () => ['cohort-a', 'cohort-b'],
      };

      const result = getEvaluationHealthCheck(mockFeatureFlagService as any);

      expect(result.configuredCohorts).toEqual(['cohort-a', 'cohort-b']);
    });
  });
});
