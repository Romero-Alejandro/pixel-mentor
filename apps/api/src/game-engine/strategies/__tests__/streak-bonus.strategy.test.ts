/**
 * Unit tests for Streak Bonus Strategy.
 */

import {
  StreakBonusStrategy,
  STREAK_5_BONUS_XP,
  STREAK_30_BONUS_XP,
  STREAK_THRESHOLD,
  HIGH_STREAK_THRESHOLD,
} from '../streak-bonus.strategy';
import type { RewardContext } from '../reward.types';

// Event type constants (from gamification-ports)
const LESSON_COMPLETED = 'game:LESSON_COMPLETED';
const DAILY_LOGIN = 'game:DAILY_LOGIN';

describe('StreakBonusStrategy', () => {
  let strategy: StreakBonusStrategy;

  beforeEach(() => {
    strategy = new StreakBonusStrategy();
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('StreakBonusStrategy');
    });

    it('should have correct description', () => {
      expect(strategy.description).toBe(
        'Awards bonus XP for maintaining streaks (5+ days = +10 XP, 30+ days = +25 XP)',
      );
    });
  });

  describe('constants', () => {
    it('should have correct streak threshold', () => {
      expect(STREAK_THRESHOLD).toBe(5);
    });

    it('should have correct high streak threshold', () => {
      expect(HIGH_STREAK_THRESHOLD).toBe(30);
    });

    it('should have correct 5-day bonus XP', () => {
      expect(STREAK_5_BONUS_XP).toBe(10);
    });

    it('should have correct 30-day bonus XP', () => {
      expect(STREAK_30_BONUS_XP).toBe(25);
    });
  });

  describe('canApply', () => {
    const createContext = (eventType: string, streak: number): RewardContext => ({
      userId: 'user-123',
      event: {
        type: eventType,
        payload: {
          userId: 'user-123',
          loginDate: new Date(),
        },
      },
      metadata: {
        profile: {
          level: 1,
          totalXP: 0,
          streak,
          longestStreak: streak,
          totalBadges: 0,
          completedLessons: 1,
        },
      },
    });

    it('should return true for DAILY_LOGIN with 5-day streak', async () => {
      const context = createContext(DAILY_LOGIN, 5);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return true for DAILY_LOGIN with 10-day streak', async () => {
      const context = createContext(DAILY_LOGIN, 10);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return true for DAILY_LOGIN with 30-day streak', async () => {
      const context = createContext(DAILY_LOGIN, 30);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return true for DAILY_LOGIN with 50-day streak', async () => {
      const context = createContext(DAILY_LOGIN, 50);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return false for DAILY_LOGIN with 4-day streak', async () => {
      const context = createContext(DAILY_LOGIN, 4);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false for LESSON_COMPLETED event', async () => {
      const context = createContext(LESSON_COMPLETED, 10);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false when no profile exists', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: DAILY_LOGIN,
          payload: {
            userId: 'user-123',
            loginDate: new Date(),
          },
        },
        metadata: {},
      };
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });
  });

  describe('getReward', () => {
    it('should return +10 XP for 5-day streak', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: DAILY_LOGIN,
          payload: {
            userId: 'user-123',
            loginDate: new Date(),
          },
        },
        metadata: {
          profile: {
            level: 1,
            totalXP: 0,
            streak: 5,
            longestStreak: 5,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.type).toBe('STREAK_BONUS');
      expect(reward!.amount).toBe(STREAK_5_BONUS_XP);
      expect(reward!.description).toContain('5-day streak');
      expect(reward!.description).toContain('+10 XP');
    });

    it('should return +10 XP for 15-day streak', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: DAILY_LOGIN,
          payload: {
            userId: 'user-123',
            loginDate: new Date(),
          },
        },
        metadata: {
          profile: {
            level: 1,
            totalXP: 0,
            streak: 15,
            longestStreak: 15,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(STREAK_5_BONUS_XP);
      expect(reward!.description).toContain('15-day streak');
    });

    it('should return +25 XP for 30-day streak', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: DAILY_LOGIN,
          payload: {
            userId: 'user-123',
            loginDate: new Date(),
          },
        },
        metadata: {
          profile: {
            level: 1,
            totalXP: 0,
            streak: 30,
            longestStreak: 30,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(STREAK_30_BONUS_XP);
      expect(reward!.description).toContain('30-day streak');
      expect(reward!.description).toContain('+25 XP');
    });

    it('should return +25 XP for 45-day streak (higher tier)', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: DAILY_LOGIN,
          payload: {
            userId: 'user-123',
            loginDate: new Date(),
          },
        },
        metadata: {
          profile: {
            level: 1,
            totalXP: 0,
            streak: 45,
            longestStreak: 45,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(STREAK_30_BONUS_XP);
      expect(reward!.description).toContain('45-day streak');
    });

    it('should return null when canApply returns false', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
          },
        },
        metadata: {
          profile: {
            level: 1,
            totalXP: 0,
            streak: 10,
            longestStreak: 10,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);
      expect(reward).toBeNull();
    });

    it('should return null when streak is below threshold', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: DAILY_LOGIN,
          payload: {
            userId: 'user-123',
            loginDate: new Date(),
          },
        },
        metadata: {
          profile: {
            level: 1,
            totalXP: 0,
            streak: 4,
            longestStreak: 4,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);
      expect(reward).toBeNull();
    });
  });
});
