/**
 * Unit tests for Badge Reward Strategies.
 */

import {
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
  FIRST_LESSON_BADGE_CODE,
  STREAK_7_BADGE_CODE,
  STREAK_30_BADGE_CODE,
} from '../badge-reward.strategy';
import type { RewardContext } from '../reward.types';

// Event type constants (from gamification-ports)
const LESSON_COMPLETED = 'game:LESSON_COMPLETED';
const DAILY_LOGIN = 'game:DAILY_LOGIN';

describe('FirstLessonBadgeStrategy', () => {
  let strategy: FirstLessonBadgeStrategy;

  beforeEach(() => {
    strategy = new FirstLessonBadgeStrategy();
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('FirstLessonBadgeStrategy');
    });

    it('should have correct description', () => {
      expect(strategy.description).toBe('Awards the first lesson badge on first completion');
    });
  });

  describe('canApply', () => {
    const createContext = (
      eventType: string,
      earnedBadgeCodes: string[] = [],
      completedLessons: number = 0,
    ): RewardContext => ({
      userId: 'user-123',
      event: {
        type: eventType,
        payload: {
          userId: 'user-123',
          lessonId: 'lesson-1',
          lessonTitle: 'Test Lesson',
          completedAt: new Date(),
        },
      },
      metadata: {
        earnedBadgeCodes,
        profile: {
          level: 1,
          totalXP: 0,
          streak: 0,
          longestStreak: 0,
          totalBadges: 0,
          completedLessons,
        },
      },
    });

    it('should return true for LESSON_COMPLETED when badge not earned', async () => {
      const context = createContext(LESSON_COMPLETED, [], 0);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return false when badge already earned', async () => {
      const context = createContext(LESSON_COMPLETED, [FIRST_LESSON_BADGE_CODE], 1);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false for non-LESSON_COMPLETED events', async () => {
      const context = createContext(DAILY_LOGIN);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return true when completedLessons is 0', async () => {
      const context = createContext(LESSON_COMPLETED, [], 0);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return true when no profile data exists (assumes first lesson)', async () => {
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
        metadata: {},
      };
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });
  });

  describe('getReward', () => {
    it('should return correct badge reward', async () => {
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
        metadata: {},
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.type).toBe('BADGE');
      expect(reward!.badgeCode).toBe(FIRST_LESSON_BADGE_CODE);
      expect(reward!.badgeName).toBe('Primera Lección');
      expect(reward!.badgeIcon).toBe('🌱');
      expect(reward!.description).toContain('first lesson');
    });

    it('should return null when badge already earned', async () => {
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
          earnedBadgeCodes: [FIRST_LESSON_BADGE_CODE],
          profile: {
            level: 1,
            totalXP: 50,
            streak: 0,
            longestStreak: 0,
            totalBadges: 1,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);
      expect(reward).toBeNull();
    });
  });
});

describe('StreakMilestone7Strategy', () => {
  let strategy: StreakMilestone7Strategy;

  beforeEach(() => {
    strategy = new StreakMilestone7Strategy();
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('StreakMilestone7Strategy');
    });

    it('should have correct description', () => {
      expect(strategy.description).toBe('Awards the 7-day streak badge');
    });
  });

  describe('canApply', () => {
    const createContext = (streak: number, earnedBadgeCodes: string[] = []): RewardContext => ({
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
        earnedBadgeCodes,
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

    it('should return true when streak is exactly 7', async () => {
      const context = createContext(7);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return true when streak is greater than 7', async () => {
      const context = createContext(10);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return false when streak is less than 7', async () => {
      const context = createContext(6);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false when badge already earned', async () => {
      const context = createContext(7, [STREAK_7_BADGE_CODE]);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false when no profile exists', async () => {
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
        metadata: {},
      };
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });
  });

  describe('getReward', () => {
    it('should return correct badge reward', async () => {
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
            streak: 7,
            longestStreak: 7,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.type).toBe('BADGE');
      expect(reward!.badgeCode).toBe(STREAK_7_BADGE_CODE);
      expect(reward!.badgeName).toBe('Racha de 7');
      expect(reward!.badgeIcon).toBe('🔥');
    });
  });
});

describe('StreakMilestone30Strategy', () => {
  let strategy: StreakMilestone30Strategy;

  beforeEach(() => {
    strategy = new StreakMilestone30Strategy();
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('StreakMilestone30Strategy');
    });

    it('should have correct description', () => {
      expect(strategy.description).toBe('Awards the 30-day streak badge');
    });
  });

  describe('canApply', () => {
    const createContext = (streak: number, earnedBadgeCodes: string[] = []): RewardContext => ({
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
        earnedBadgeCodes,
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

    it('should return true when streak is exactly 30', async () => {
      const context = createContext(30);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return true when streak is greater than 30', async () => {
      const context = createContext(45);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return false when streak is less than 30', async () => {
      const context = createContext(29);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false when badge already earned', async () => {
      const context = createContext(30, [STREAK_30_BADGE_CODE]);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });
  });

  describe('getReward', () => {
    it('should return correct badge reward', async () => {
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
            streak: 30,
            longestStreak: 30,
            totalBadges: 0,
            completedLessons: 1,
          },
        },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.type).toBe('BADGE');
      expect(reward!.badgeCode).toBe(STREAK_30_BADGE_CODE);
      expect(reward!.badgeName).toBe('Racha de 30');
      expect(reward!.badgeIcon).toBe('🔥');
    });
  });
});
