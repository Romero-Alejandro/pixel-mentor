/**
 * Unit tests for XP Reward Strategy.
 */

import { LessonCompletionStrategy, BASE_LESSON_XP } from '../xp-reward.strategy';
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
      expect(strategy.description).toBe('Awards base XP for completing lessons');
    });
  });

  describe('canApply', () => {
    const createContext = (eventType: string): RewardContext => ({
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
      metadata: {},
    });

    it('should return true for LESSON_COMPLETED event', async () => {
      const context = createContext(LESSON_COMPLETED);
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
    it('should return correct XP reward', async () => {
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
      expect(reward!.type).toBe('XP');
      expect(reward!.amount).toBe(BASE_LESSON_XP);
      expect(reward!.description).toContain('Base XP for completing a lesson');
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

    it('should always return BASE_LESSON_XP amount', async () => {
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

      expect(reward!.amount).toBe(50);
    });
  });
});
