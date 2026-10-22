import {
  BadgeRuleEvaluator,
  HIGH_PARTIAL_CREDIT_MIN_SCORE,
  COMPLETED_LESSON_STATUSES,
  type BadgeMetrics,
} from '@/features/gamification/application/services/badge-rule.evaluator.js';
import type { BadgeDefinition } from '@/features/gamification/domain/entities/badge.types.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port';

function metrics(overrides: Partial<BadgeMetrics> = {}): BadgeMetrics {
  return {
    streak: 0,
    level: 1,
    completedLessons: 0,
    perfectFirstAttempts: 0,
    hintFreePerfectLessons: 0,
    highPartialCreditLessons: 0,
    ...overrides,
  };
}

function badge(
  code: string,
  type: BadgeDefinition['rules']['type'],
  value: number,
): BadgeDefinition {
  return {
    code,
    name: code,
    description: '',
    icon: '🏆',
    xpReward: 0,
    rules: { type, value },
    isActive: true,
  };
}

describe('BadgeRuleEvaluator', () => {
  let userGamificationRepo: { getProfileStats: jest.Mock };
  let progressRepo: { countByUserIdAndStatus: jest.Mock };
  let activityAttemptRepo: {
    countCorrectFirstAttempts: jest.Mock;
    countHintFreeCorrectFirstAttemptAtoms: jest.Mock;
    countAtomsWithHighPartialCredit: jest.Mock;
  };
  let evaluator: BadgeRuleEvaluator;

  beforeEach(() => {
    userGamificationRepo = { getProfileStats: jest.fn().mockResolvedValue(null) };
    progressRepo = { countByUserIdAndStatus: jest.fn().mockResolvedValue(0) };
    activityAttemptRepo = {
      countCorrectFirstAttempts: jest.fn().mockResolvedValue(0),
      countHintFreeCorrectFirstAttemptAtoms: jest.fn().mockResolvedValue(0),
      countAtomsWithHighPartialCredit: jest.fn().mockResolvedValue(0),
    };

    evaluator = new BadgeRuleEvaluator(
      userGamificationRepo as unknown as IUserGamificationRepository,
      progressRepo as unknown as ProgressRepository,
      activityAttemptRepo as unknown as ActivityAttemptRepository,
    );
  });

  describe('loadMetrics', () => {
    it('loads every counter in one batch and defaults missing stats', async () => {
      const result = await evaluator.loadMetrics('user-1');

      expect(result).toEqual({
        streak: 0,
        level: 1,
        completedLessons: 0,
        perfectFirstAttempts: 0,
        hintFreePerfectLessons: 0,
        highPartialCreditLessons: 0,
      });
      expect(progressRepo.countByUserIdAndStatus).toHaveBeenCalledWith('user-1', [
        ...COMPLETED_LESSON_STATUSES,
      ]);
      expect(activityAttemptRepo.countAtomsWithHighPartialCredit).toHaveBeenCalledWith(
        'user-1',
        HIGH_PARTIAL_CREDIT_MIN_SCORE,
      );
    });

    it('reads streak and level from the gamification profile', async () => {
      userGamificationRepo.getProfileStats.mockResolvedValue({
        currentStreak: 7,
        level: 3,
        totalXP: 260,
        totalBadges: 2,
      });

      const result = await evaluator.loadMetrics('user-1');

      expect(result.streak).toBe(7);
      expect(result.level).toBe(3);
    });
  });

  describe('evaluate', () => {
    it.each([
      ['LESSON_COUNT' as const, { completedLessons: 5 }, 5, true],
      ['STREAK' as const, { streak: 3 }, 7, false],
      ['LEVEL' as const, { level: 5 }, 5, true],
      ['PERFECT_ATTEMPT' as const, { perfectFirstAttempts: 0 }, 1, false],
      ['HINT_FREE_PERFECT_LESSONS' as const, { hintFreePerfectLessons: 4 }, 3, true],
      ['HIGH_PARTIAL_CREDIT_LESSONS' as const, { highPartialCreditLessons: 2 }, 3, false],
    ])('evaluates %s', (type, metricValues, target, satisfied) => {
      const result = evaluator.evaluate(
        { type, value: target },
        metrics(metricValues as Partial<BadgeMetrics>),
      );

      expect(result?.satisfied).toBe(satisfied);
      expect(result?.target).toBe(target);
    });

    it('caps the reported current value at the target', () => {
      const result = evaluator.evaluate(
        { type: 'LESSON_COUNT', value: 5 },
        metrics({ completedLessons: 9 }),
      );

      expect(result).toEqual({ current: 5, target: 5, satisfied: true });
    });

    it('reports the raw value below the target', () => {
      const result = evaluator.evaluate(
        { type: 'LESSON_COUNT', value: 5 },
        metrics({ completedLessons: 2 }),
      );

      expect(result).toEqual({ current: 2, target: 5, satisfied: false });
    });

    it('returns null for a non-positive target', () => {
      expect(evaluator.evaluate({ type: 'LESSON_COUNT', value: 0 }, metrics())).toBeNull();
      expect(evaluator.evaluate({ type: 'LESSON_COUNT', value: -3 }, metrics())).toBeNull();
      expect(evaluator.evaluate({ type: 'LESSON_COUNT', value: Number.NaN }, metrics())).toBeNull();
    });

    it('returns null for an unknown rule type instead of showing 0% progress', () => {
      const result = evaluator.evaluate(
        { type: 'NOT_A_RULE' as never, value: 1 },
        metrics({ completedLessons: 10 }),
      );

      expect(result).toBeNull();
    });
  });

  describe('evaluateAll', () => {
    it('evaluates the whole catalog with a single metrics load', async () => {
      const catalog = [
        badge('FIRST_LESSON', 'LESSON_COUNT', 1),
        badge('STREAK_7', 'STREAK', 7),
        badge('BROKEN', 'NOT_A_RULE' as never, 1),
      ];

      const result = await evaluator.evaluateAll('user-1', catalog);

      expect(userGamificationRepo.getProfileStats).toHaveBeenCalledTimes(1);
      expect(progressRepo.countByUserIdAndStatus).toHaveBeenCalledTimes(1);
      expect(Array.from(result.keys())).toEqual(['FIRST_LESSON', 'STREAK_7']);
    });
  });
});
