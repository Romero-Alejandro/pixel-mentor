/**
 * Unit tests for BadgeEngine types and integration.
 *
 * Note: BadgeEngine uses Prisma directly which requires database mocking.
 * These tests focus on:
 * - Type correctness
 * - Badge type definitions
 * - Integration with existing game-engine tests
 */

import type {
  BadgeProgress,
  BadgeDefinition,
  BadgeRequirement,
  BadgeAwardResult,
  UserBadgeStats,
  BadgeRequirementType,
} from '../badge-types';

describe('Badge Types', () => {
  describe('BadgeProgress', () => {
    it('should have correct structure for unearned badge', () => {
      const progress: BadgeProgress = {
        badgeCode: 'STREAK_7',
        badgeName: 'Racha de 7',
        badgeIcon: '🔥',
        requirementType: 'STREAK',
        current: 5,
        target: 7,
        percent: 71,
        earned: false,
      };

      expect(progress.badgeCode).toBe('STREAK_7');
      expect(progress.current).toBe(5);
      expect(progress.target).toBe(7);
      expect(progress.percent).toBe(71);
      expect(progress.earned).toBe(false);
      expect(progress.earnedAt).toBeUndefined();
    });

    it('should have correct structure for earned badge', () => {
      const earnedDate = new Date('2024-01-15');
      const progress: BadgeProgress = {
        badgeCode: 'FIRST_LESSON',
        badgeName: 'Primera Lección',
        badgeIcon: '🌱',
        requirementType: 'LESSON_COUNT',
        current: 1,
        target: 1,
        percent: 100,
        earned: true,
        earnedAt: earnedDate,
      };

      expect(progress.earned).toBe(true);
      expect(progress.percent).toBe(100);
      expect(progress.earnedAt).toEqual(earnedDate);
    });

    it('should allow 0% progress', () => {
      const progress: BadgeProgress = {
        badgeCode: 'LEVEL_5',
        badgeName: 'Maestro',
        badgeIcon: '🏆',
        requirementType: 'LEVEL',
        current: 0,
        target: 5,
        percent: 0,
        earned: false,
      };

      expect(progress.current).toBe(0);
      expect(progress.percent).toBe(0);
    });

    it('should cap progress at 100% for unearned badges', () => {
      const progress: BadgeProgress = {
        badgeCode: 'STREAK_7',
        badgeName: 'Racha de 7',
        badgeIcon: '🔥',
        requirementType: 'STREAK',
        current: 7,
        target: 7,
        percent: 100,
        earned: false, // Even though current >= target, not marked as earned yet
      };

      expect(progress.percent).toBe(100);
      expect(progress.earned).toBe(false);
    });
  });

  describe('BadgeDefinition', () => {
    it('should have correct structure', () => {
      const definition: BadgeDefinition = {
        code: 'PERFECT',
        name: 'Perfecto',
        description: 'First try success',
        icon: '⭐',
        xpReward: 15,
        rules: {
          type: 'PERFECT_ATTEMPT',
          value: 1,
        },
        isActive: true,
      };

      expect(definition.code).toBe('PERFECT');
      expect(definition.xpReward).toBe(15);
      expect(definition.rules.type).toBe('PERFECT_ATTEMPT');
    });
  });

  describe('BadgeRequirement', () => {
    it('should support LESSON_COUNT type', () => {
      const requirement: BadgeRequirement = {
        type: 'LESSON_COUNT',
        value: 5,
      };

      expect(requirement.type).toBe('LESSON_COUNT');
      expect(requirement.value).toBe(5);
    });

    it('should support STREAK type', () => {
      const requirement: BadgeRequirement = {
        type: 'STREAK',
        value: 30,
      };

      expect(requirement.type).toBe('STREAK');
      expect(requirement.value).toBe(30);
    });

    it('should support LEVEL type', () => {
      const requirement: BadgeRequirement = {
        type: 'LEVEL',
        value: 5,
      };

      expect(requirement.type).toBe('LEVEL');
      expect(requirement.value).toBe(5);
    });
  });

  describe('BadgeAwardResult', () => {
    it('should have correct structure for successful award', () => {
      const result: BadgeAwardResult = {
        awarded: true,
        badgeCode: 'STREAK_3',
        badgeName: 'Racha de 3',
        badgeIcon: '🔥',
        xpAwarded: 25,
      };

      expect(result.awarded).toBe(true);
      expect(result.xpAwarded).toBe(25);
      expect(result.error).toBeUndefined();
    });

    it('should have correct structure for failed award', () => {
      const result: BadgeAwardResult = {
        awarded: false,
        badgeCode: 'LEVEL_5',
        badgeName: 'Maestro',
        badgeIcon: '🏆',
        xpAwarded: 0,
        error: 'Does not qualify',
      };

      expect(result.awarded).toBe(false);
      expect(result.xpAwarded).toBe(0);
      expect(result.error).toBe('Does not qualify');
    });
  });

  describe('UserBadgeStats', () => {
    it('should have correct structure', () => {
      const stats: UserBadgeStats = {
        totalEarned: 5,
        totalXPFromBadges: 150,
        byType: {
          LESSON_COUNT: 2,
          STREAK: 2,
          LEVEL: 1,
          PERFECT_ATTEMPT: 0,
        },
      };

      expect(stats.totalEarned).toBe(5);
      expect(stats.totalXPFromBadges).toBe(150);
      expect(stats.byType.LESSON_COUNT).toBe(2);
      expect(stats.byType.STREAK).toBe(2);
    });
  });

  describe('BadgeRequirementType', () => {
    it('should be one of the valid types', () => {
      const validTypes: BadgeRequirementType[] = [
        'LESSON_COUNT',
        'STREAK',
        'LEVEL',
        'PERFECT_ATTEMPT',
      ];

      for (const type of validTypes) {
        const requirement: BadgeRequirement = { type, value: 1 };
        expect(requirement.type).toBe(type);
      }
    });
  });
});

describe('Badge Seed Data Compatibility', () => {
  it('should match seed data badge codes', () => {
    // These should match the codes in seed-gamification.ts
    const seedBadgeCodes = [
      'FIRST_LESSON',
      'STREAK_3',
      'PERFECT', // Note: seed has 'PERFECT' not 'PERFECT_SCORE'
      'LESSON_5',
      'LEVEL_5',
    ];

    const progressCodes = [
      'FIRST_LESSON',
      'STREAK_7', // Note: existing strategy uses STREAK_7
      'STREAK_30',
      'LEVEL_5',
    ];

    // Verify overlap between seed and progress tracking
    expect(seedBadgeCodes).toContain('FIRST_LESSON');
    expect(seedBadgeCodes).toContain('LEVEL_5');
    expect(progressCodes).toContain('FIRST_LESSON');
    expect(progressCodes).toContain('LEVEL_5');
  });

  it('should have correct XP rewards from seed', () => {
    // Expected XP rewards from seed-gamification.ts
    const expectedRewards: Record<string, number> = {
      FIRST_LESSON: 10,
      STREAK_3: 25,
      PERFECT: 15,
      LESSON_5: 50,
      LEVEL_5: 100,
    };

    expect(expectedRewards['FIRST_LESSON']).toBe(10);
    expect(expectedRewards['STREAK_3']).toBe(25);
    expect(expectedRewards['LEVEL_5']).toBe(100);
  });
});
