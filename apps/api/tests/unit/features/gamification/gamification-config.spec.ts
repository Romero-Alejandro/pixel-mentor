import {
  GamificationConfig,
  type GamificationConfigType,
} from '@/features/gamification/config/gamification.config.js';

describe('GamificationConfig', () => {
  describe('BASE_LESSON_XP', () => {
    it('should be a positive number', () => {
      expect(GamificationConfig.BASE_LESSON_XP).toBeGreaterThan(0);
    });

    it('should be a number', () => {
      expect(typeof GamificationConfig.BASE_LESSON_XP).toBe('number');
    });

    it('should export type for TypeScript usage', () => {
      const config: GamificationConfigType = GamificationConfig;
      expect(config).toBeDefined();
    });
  });

  describe('PERFECT_FIRST_ATTEMPT_BONUS', () => {
    it('should be a positive number', () => {
      expect(GamificationConfig.PERFECT_FIRST_ATTEMPT_BONUS).toBeGreaterThan(0);
    });

    it('should be less than or equal to BASE_LESSON_XP', () => {
      expect(GamificationConfig.PERFECT_FIRST_ATTEMPT_BONUS).toBeLessThanOrEqual(
        GamificationConfig.BASE_LESSON_XP,
      );
    });
  });

  describe('XP_TIERS', () => {
    it('should have PERFECT tier', () => {
      expect(GamificationConfig.XP_TIERS.PERFECT).toBeDefined();
      expect(GamificationConfig.XP_TIERS.PERFECT.minAccuracy).toBe(100);
      expect(GamificationConfig.XP_TIERS.PERFECT.xp).toBeGreaterThan(0);
    });

    it('should have HIGH tier', () => {
      expect(GamificationConfig.XP_TIERS.HIGH).toBeDefined();
      expect(GamificationConfig.XP_TIERS.HIGH.minAccuracy).toBe(80);
    });

    it('should have MEDIUM tier', () => {
      expect(GamificationConfig.XP_TIERS.MEDIUM).toBeDefined();
      expect(GamificationConfig.XP_TIERS.MEDIUM.minAccuracy).toBe(50);
    });

    it('should have LOW tier', () => {
      expect(GamificationConfig.XP_TIERS.LOW).toBeDefined();
      expect(GamificationConfig.XP_TIERS.LOW.minAccuracy).toBe(0);
    });

    it('should have tier XP values in descending order', () => {
      const { PERFECT, HIGH, MEDIUM, LOW } = GamificationConfig.XP_TIERS;
      expect(PERFECT.xp).toBeGreaterThanOrEqual(HIGH.xp);
      expect(HIGH.xp).toBeGreaterThanOrEqual(MEDIUM.xp);
      expect(MEDIUM.xp).toBeGreaterThanOrEqual(LOW.xp);
    });

    it('should have minAccuracy in ascending order', () => {
      const { PERFECT, HIGH, MEDIUM, LOW } = GamificationConfig.XP_TIERS;
      expect(LOW.minAccuracy).toBeLessThan(MEDIUM.minAccuracy);
      expect(MEDIUM.minAccuracy).toBeLessThan(HIGH.minAccuracy);
      expect(HIGH.minAccuracy).toBeLessThan(PERFECT.minAccuracy);
    });
  });

  describe('STREAK_BONUS_XP', () => {
    it('should have 5-day streak bonus', () => {
      expect(GamificationConfig.STREAK_5_BONUS_XP).toBeGreaterThan(0);
    });

    it('should have 30-day streak bonus', () => {
      expect(GamificationConfig.STREAK_30_BONUS_XP).toBeGreaterThan(0);
    });

    it('should have 30-day bonus greater than 5-day bonus', () => {
      expect(GamificationConfig.STREAK_30_BONUS_XP).toBeGreaterThan(
        GamificationConfig.STREAK_5_BONUS_XP,
      );
    });
  });

  describe('MULTIPLIER', () => {
    it('should have HIGH multiplier greater than 1', () => {
      expect(GamificationConfig.MULTIPLIER.HIGH).toBeGreaterThan(1);
    });

    it('should have MEDIUM multiplier greater than or equal to 1', () => {
      expect(GamificationConfig.MULTIPLIER.MEDIUM).toBeGreaterThanOrEqual(1);
    });

    it('should have LOW multiplier equal to 1', () => {
      expect(GamificationConfig.MULTIPLIER.LOW).toBe(1);
    });

    it('should have multipliers in descending order', () => {
      const { HIGH, MEDIUM, LOW } = GamificationConfig.MULTIPLIER;
      expect(HIGH).toBeGreaterThanOrEqual(MEDIUM);
      expect(MEDIUM).toBeGreaterThanOrEqual(LOW);
    });
  });

  describe('TypeScript type', () => {
    it('should export type for TypeScript usage', () => {
      const config: GamificationConfigType = GamificationConfig;
      expect(config).toBeDefined();
    });
  });
});
