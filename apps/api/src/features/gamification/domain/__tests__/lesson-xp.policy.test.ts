import {
  calculateXPFromAccuracy,
  calculateLessonXp,
  getPerformanceTier,
  BASE_LESSON_XP,
  PERFECT_FIRST_ATTEMPT_BONUS,
  ASSISTED_PERFECT_FIRST_ATTEMPT_BONUS,
  PARTIAL_CREDIT_BONUS,
} from '@/features/gamification/domain/lesson-xp.policy.js';
import type { LessonCompletedPayload } from '@/shared/events/game-events.js';

describe('calculateXPFromAccuracy — bonuses', () => {
  it('pays the full perfect bonus without hints', () => {
    const xp = calculateXPFromAccuracy(100, true, {
      accuracyPercent: 100,
      allCorrectOnFirstAttempt: true,
      anyHintUsed: false,
    });
    expect(xp).toBe(BASE_LESSON_XP + PERFECT_FIRST_ATTEMPT_BONUS);
  });

  it('pays the halved perfect bonus when hints were used', () => {
    const xp = calculateXPFromAccuracy(100, true, {
      accuracyPercent: 100,
      allCorrectOnFirstAttempt: true,
      anyHintUsed: true,
    });
    expect(xp).toBe(BASE_LESSON_XP + ASSISTED_PERFECT_FIRST_ATTEMPT_BONUS);
  });

  it('defaults to the legacy full bonus when hint info is absent (back-compat)', () => {
    expect(calculateXPFromAccuracy(100, true)).toBe(BASE_LESSON_XP + PERFECT_FIRST_ATTEMPT_BONUS);
    expect(calculateXPFromAccuracy(100, true, false)).toBe(
      BASE_LESSON_XP + PERFECT_FIRST_ATTEMPT_BONUS,
    );
    expect(calculateXPFromAccuracy(100, true, true)).toBe(
      BASE_LESSON_XP + ASSISTED_PERFECT_FIRST_ATTEMPT_BONUS,
    );
  });

  it('pays the partial-credit bonus for high partial score on non-perfect runs', () => {
    const xp = calculateXPFromAccuracy(75, false, {
      accuracyPercent: 75,
      allCorrectOnFirstAttempt: false,
      partialCreditPercent: 87,
    });
    // 75% accuracy lands in the MEDIUM tier (30 XP).
    expect(xp).toBe(30 + PARTIAL_CREDIT_BONUS);
  });

  it('does not stack the partial-credit bonus on a perfect run', () => {
    const xp = calculateXPFromAccuracy(100, true, {
      accuracyPercent: 100,
      allCorrectOnFirstAttempt: true,
      anyHintUsed: false,
      partialCreditPercent: 95,
    });
    expect(xp).toBe(BASE_LESSON_XP + PERFECT_FIRST_ATTEMPT_BONUS);
  });

  it('requires at least 80 partial credit for the bonus', () => {
    const xp = calculateXPFromAccuracy(75, false, {
      accuracyPercent: 75,
      allCorrectOnFirstAttempt: false,
      partialCreditPercent: 79,
    });
    expect(xp).toBe(30);
  });

  it('keeps legacy binary behavior without details', () => {
    expect(calculateXPFromAccuracy(100)).toBe(BASE_LESSON_XP);
    expect(calculateXPFromAccuracy(80)).toBe(BASE_LESSON_XP);
    expect(calculateXPFromAccuracy(50)).toBe(30);
    expect(calculateXPFromAccuracy(20)).toBe(10);
    expect(getPerformanceTier(100)).toBe('perfect');
  });
});

describe('calculateLessonXp — payload adapter', () => {
  function accuracy(
    overrides: Partial<NonNullable<LessonCompletedPayload['accuracy']>>,
  ): NonNullable<LessonCompletedPayload['accuracy']> {
    return {
      correctFirstAttempts: 3,
      correctLastAttempts: 3,
      totalActivities: 3,
      skippedActivities: 0,
      accuracyPercent: 100,
      allCorrectOnFirstAttempt: true,
      ...overrides,
    };
  }

  it('pays the base tier when the lesson has no accuracy data', () => {
    expect(calculateLessonXp(undefined)).toBe(BASE_LESSON_XP);
  });

  it('applies the assisted perfect bonus when hints were used', () => {
    const xp = calculateLessonXp(accuracy({ anyHintUsed: true }));
    expect(xp).toBe(BASE_LESSON_XP + ASSISTED_PERFECT_FIRST_ATTEMPT_BONUS);
  });

  it('applies the partial-credit bonus for high partial mastery', () => {
    const xp = calculateLessonXp(
      accuracy({
        correctFirstAttempts: 1,
        correctLastAttempts: 3,
        totalActivities: 4,
        accuracyPercent: 75,
        allCorrectOnFirstAttempt: false,
        partialCreditPercent: 92,
      }),
    );
    expect(xp).toBe(30 + PARTIAL_CREDIT_BONUS);
  });

  it('pays the medium tier for a plain binary run', () => {
    const xp = calculateLessonXp(
      accuracy({
        correctFirstAttempts: 1,
        correctLastAttempts: 2,
        totalActivities: 3,
        accuracyPercent: 67,
        allCorrectOnFirstAttempt: false,
      }),
    );
    expect(xp).toBe(30);
  });
});
