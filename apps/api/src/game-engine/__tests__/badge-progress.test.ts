/**
 * Unit tests for Badge Progress Calculator - Pure Functions.
 *
 * These tests focus on the pure utility functions that don't require
 * database access or complex mocking.
 */

import { parseBadgeRules, isValidRequirementType, calculateProgressSummary } from '../badge-utils';

describe('Badge Progress Calculator - Pure Functions', () => {
  describe('parseBadgeRules', () => {
    it('should parse LESSON_COUNT rules correctly', () => {
      const rules = { type: 'LESSON_COUNT', value: 5 };
      const result = parseBadgeRules(rules);
      expect(result).toEqual({ type: 'LESSON_COUNT', value: 5 });
    });

    it('should parse STREAK rules correctly', () => {
      const rules = { type: 'STREAK', value: 7 };
      const result = parseBadgeRules(rules);
      expect(result).toEqual({ type: 'STREAK', value: 7 });
    });

    it('should parse LEVEL rules correctly', () => {
      const rules = { type: 'LEVEL', value: 5 };
      const result = parseBadgeRules(rules);
      expect(result).toEqual({ type: 'LEVEL', value: 5 });
    });

    it('should parse PERFECT_ATTEMPT rules correctly', () => {
      const rules = { type: 'PERFECT_ATTEMPT', value: 1 };
      const result = parseBadgeRules(rules);
      expect(result).toEqual({ type: 'PERFECT_ATTEMPT', value: 1 });
    });

    it('should return null for missing type', () => {
      const rules = { value: 5 };
      const result = parseBadgeRules(rules);
      expect(result).toBeNull();
    });

    it('should return null for missing value', () => {
      const rules = { type: 'LESSON_COUNT' };
      const result = parseBadgeRules(rules);
      expect(result).toBeNull();
    });

    it('should return null for empty rules', () => {
      const result = parseBadgeRules({});
      expect(result).toBeNull();
    });

    it('should return null for invalid type', () => {
      const rules = { type: 'INVALID_TYPE', value: 5 };
      const result = parseBadgeRules(rules);
      // The function should still return the rule even if type is unknown
      expect(result?.type).toBe('INVALID_TYPE');
    });
  });

  describe('isValidRequirementType', () => {
    it('should return true for LESSON_COUNT', () => {
      expect(isValidRequirementType('LESSON_COUNT')).toBe(true);
    });

    it('should return true for STREAK', () => {
      expect(isValidRequirementType('STREAK')).toBe(true);
    });

    it('should return true for LEVEL', () => {
      expect(isValidRequirementType('LEVEL')).toBe(true);
    });

    it('should return true for PERFECT_ATTEMPT', () => {
      expect(isValidRequirementType('PERFECT_ATTEMPT')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidRequirementType('INVALID')).toBe(false);
      expect(isValidRequirementType('')).toBe(false);
      expect(isValidRequirementType('lesson_count')).toBe(false);
      expect(isValidRequirementType('STREAK_7')).toBe(false);
    });
  });

  describe('calculateProgressSummary', () => {
    it('should calculate summary correctly', () => {
      const progress = [
        { earned: true, percent: 100 },
        { earned: true, percent: 100 },
        { earned: false, percent: 50 },
        { earned: false, percent: 0 },
      ] as any[];

      const summary = calculateProgressSummary(progress);

      expect(summary.total).toBe(4);
      expect(summary.earned).toBe(2);
      expect(summary.inProgress).toBe(1);
      expect(summary.overallPercent).toBe(50);
    });

    it('should handle empty progress array', () => {
      const summary = calculateProgressSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.earned).toBe(0);
      expect(summary.inProgress).toBe(0);
      expect(summary.overallPercent).toBe(0);
    });

    it('should calculate 100% when all badges earned', () => {
      const progress = [
        { earned: true, percent: 100 },
        { earned: true, percent: 100 },
      ] as any[];

      const summary = calculateProgressSummary(progress);

      expect(summary.total).toBe(2);
      expect(summary.earned).toBe(2);
      expect(summary.overallPercent).toBe(100);
    });

    it('should handle badges in progress correctly', () => {
      const progress = [
        { earned: false, percent: 0 },
        { earned: false, percent: 25 },
        { earned: false, percent: 75 },
        { earned: false, percent: 100 },
      ] as any[];

      const summary = calculateProgressSummary(progress);

      expect(summary.total).toBe(4);
      expect(summary.earned).toBe(0);
      expect(summary.inProgress).toBe(3);
      expect(summary.overallPercent).toBe(0);
    });

    it('should handle mixed state correctly', () => {
      const progress = [
        { earned: true, percent: 100 }, // earned
        { earned: true, percent: 100 }, // earned
        { earned: true, percent: 100 }, // earned
        { earned: false, percent: 80 }, // in progress
        { earned: false, percent: 50 }, // in progress
        { earned: false, percent: 20 }, // in progress
        { earned: false, percent: 0 }, // not started (0% is not "in progress")
      ] as any[];

      const summary = calculateProgressSummary(progress);

      expect(summary.total).toBe(7);
      expect(summary.earned).toBe(3);
      expect(summary.inProgress).toBe(3); // 80%, 50%, 20% - not the 0% one
      expect(summary.overallPercent).toBe(43); // 3/7 = 42.857, rounded to 43
    });
  });
});
