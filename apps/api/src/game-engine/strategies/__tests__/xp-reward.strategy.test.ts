/**
 * Unit tests for XP Reward Strategy.
 */

import {
  LessonCompletionStrategy,
  BASE_LESSON_XP,
  PERFECT_FIRST_ATTEMPT_BONUS,
  calculateXPFromAccuracy,
  getPerformanceTier,
} from '../xp-reward.strategy';
import type { RewardContext } from '../reward.types';

// Event type constants (from gamification-ports)
const LESSON_COMPLETED = 'game:LESSON_COMPLETED';
const ACTIVITY_ATTEMPT = 'game:ACTIVITY_ATTEMPT';
const DAILY_LOGIN = 'game:DAILY_LOGIN';

describe('LessonCompletionStrategy', () => {
  let strategy: LessonCompletionStrategy;

  beforeEach(() => {
    strategy = new LessonCompletionStrategy();
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('LessonCompletionStrategy');
    });

    it('should have correct description', () => {
      expect(strategy.description).toBe(
        'Awards XP for completing lessons based on accuracy with first-attempt bonus (first time only)',
      );
    });
  });

  describe('canApply', () => {
    const createContext = (
      eventType: string,
      lessonId = 'lesson-1',
      completedLessonIds: string[] = [],
      accuracyPercent = 100,
      allCorrectOnFirstAttempt = true,
    ): RewardContext => ({
      userId: 'user-123',
      event: {
        type: eventType,
        payload: {
          userId: 'user-123',
          lessonId,
          lessonTitle: 'Test Lesson',
          completedAt: new Date(),
          accuracy: {
            correctFirstAttempts: 5,
            correctLastAttempts: 5,
            totalActivities: 5,
            skippedActivities: 0,
            accuracyPercent,
            allCorrectOnFirstAttempt,
          },
        },
      },
      metadata: { completedLessonIds },
    });

    it('should return true for LESSON_COMPLETED event (first time)', async () => {
      const context = createContext(LESSON_COMPLETED, 'lesson-1', []);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return false for LESSON_COMPLETED event (already completed)', async () => {
      const context = createContext(LESSON_COMPLETED, 'lesson-1', ['lesson-1']);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return true for LESSON_COMPLETED event (different lesson)', async () => {
      const context = createContext(LESSON_COMPLETED, 'lesson-2', ['lesson-1']);
      const result = await strategy.canApply(context);
      expect(result).toBe(true);
    });

    it('should return false for ACTIVITY_ATTEMPT event', async () => {
      const context = createContext(ACTIVITY_ATTEMPT);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });

    it('should return false for DAILY_LOGIN event', async () => {
      const context = createContext(DAILY_LOGIN);
      const result = await strategy.canApply(context);
      expect(result).toBe(false);
    });
  });

  describe('getReward', () => {
    it('should return 70 XP for 100% accuracy with all first attempts correct', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
            accuracy: {
              correctFirstAttempts: 5,
              correctLastAttempts: 5,
              totalActivities: 5,
              skippedActivities: 0,
              accuracyPercent: 100,
              allCorrectOnFirstAttempt: true,
            },
          },
        },
        metadata: { completedLessonIds: [] },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.type).toBe('XP');
      expect(reward!.amount).toBe(BASE_LESSON_XP + PERFECT_FIRST_ATTEMPT_BONUS);
      expect(reward!.description).toContain('100% precisión');
      expect(reward!.description).toContain('bonus primer intento');
    });

    it('should return 50 XP for 100% accuracy WITHOUT all first attempts correct', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
            accuracy: {
              correctFirstAttempts: 4,
              correctLastAttempts: 5,
              totalActivities: 5,
              skippedActivities: 0,
              accuracyPercent: 100,
              allCorrectOnFirstAttempt: false,
            },
          },
        },
        metadata: { completedLessonIds: [] },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(BASE_LESSON_XP);
      expect(reward!.description).toContain('100% precisión');
      expect(reward!.description).not.toContain('bonus primer intento');
    });

    it('should return base XP reward for 80% accuracy', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
            accuracy: {
              correctFirstAttempts: 3,
              correctLastAttempts: 4,
              totalActivities: 5,
              skippedActivities: 0,
              accuracyPercent: 80,
              allCorrectOnFirstAttempt: false,
            },
          },
        },
        metadata: { completedLessonIds: [] },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(BASE_LESSON_XP);
      expect(reward!.description).toContain('80% precisión');
    });

    it('should return reduced XP reward for 60% accuracy', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
            accuracy: {
              correctFirstAttempts: 2,
              correctLastAttempts: 3,
              totalActivities: 5,
              skippedActivities: 0,
              accuracyPercent: 60,
              allCorrectOnFirstAttempt: false,
            },
          },
        },
        metadata: { completedLessonIds: [] },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(30);
      expect(reward!.description).toContain('60% precisión');
    });

    it('should return minimum XP reward for low accuracy', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
            accuracy: {
              correctFirstAttempts: 1,
              correctLastAttempts: 1,
              totalActivities: 5,
              skippedActivities: 0,
              accuracyPercent: 20,
              allCorrectOnFirstAttempt: false,
            },
          },
        },
        metadata: { completedLessonIds: [] },
      };

      const reward = await strategy.getReward(context);

      expect(reward).not.toBeNull();
      expect(reward!.amount).toBe(10);
      expect(reward!.description).toContain('20% precisión');
    });

    it('should return null when lesson was already completed', async () => {
      const context: RewardContext = {
        userId: 'user-123',
        event: {
          type: LESSON_COMPLETED,
          payload: {
            userId: 'user-123',
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            completedAt: new Date(),
            accuracy: {
              correctFirstAttempts: 5,
              correctLastAttempts: 5,
              totalActivities: 5,
              skippedActivities: 0,
              accuracyPercent: 100,
              allCorrectOnFirstAttempt: true,
            },
          },
        },
        metadata: { completedLessonIds: ['lesson-1'] },
      };

      const reward = await strategy.getReward(context);
      expect(reward).toBeNull();
    });

    it('should return null when canApply returns false', async () => {
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

      const reward = await strategy.getReward(context);
      expect(reward).toBeNull();
    });

    it('should default to 100% accuracy when no accuracy data provided', async () => {
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
      // Default is 100% accuracy but allCorrectOnFirstAttempt defaults to false
      expect(reward!.amount).toBe(BASE_LESSON_XP);
    });
  });

  describe('calculateXPFromAccuracy', () => {
    it('should return 70 XP for 100% accuracy with all first attempts correct', () => {
      expect(calculateXPFromAccuracy(100, true)).toBe(70);
    });

    it('should return 50 XP for 100% accuracy without all first attempts correct', () => {
      expect(calculateXPFromAccuracy(100, false)).toBe(50);
    });

    it('should return 50 XP for 80% accuracy', () => {
      expect(calculateXPFromAccuracy(80)).toBe(50);
    });

    it('should return 30 XP for 60% accuracy', () => {
      expect(calculateXPFromAccuracy(60)).toBe(30);
    });

    it('should return 10 XP for 20% accuracy', () => {
      expect(calculateXPFromAccuracy(20)).toBe(10);
    });

    it('should return 10 XP for 0% accuracy', () => {
      expect(calculateXPFromAccuracy(0)).toBe(10);
    });
  });

  describe('getPerformanceTier', () => {
    it('should return "perfect" for 100% accuracy', () => {
      expect(getPerformanceTier(100)).toBe('perfect');
    });

    it('should return "high" for 80% accuracy', () => {
      expect(getPerformanceTier(80)).toBe('high');
    });

    it('should return "medium" for 60% accuracy', () => {
      expect(getPerformanceTier(60)).toBe('medium');
    });

    it('should return "low" for 20% accuracy', () => {
      expect(getPerformanceTier(20)).toBe('low');
    });
  });
});
