/**
 * Lesson XP policy — the single source of truth for how much XP a completed
 * lesson pays.
 *
 * Pure functions, no I/O: the game engine, the recipe use case and the HTTP
 * routes all call the same function, so the XP shown to the student is exactly
 * the XP the engine awards. This used to live inside a reward strategy; it is
 * domain logic, not a pluggable behaviour, so it lives here now.
 */

import type { LessonCompletedPayload } from '@/shared/events/game-events.port';

/**
 * Base XP awarded for completing a lesson.
 */
export const BASE_LESSON_XP = 50;

/**
 * XP bonus for perfect first-attempt accuracy (no hints used).
 */
export const PERFECT_FIRST_ATTEMPT_BONUS = 20;

/**
 * Perfect first-attempt bonus when hints were used — the student still earned a
 * perfect run, but assisted, so the bonus is halved.
 */
export const ASSISTED_PERFECT_FIRST_ATTEMPT_BONUS = 10;

/**
 * Bonus for high partial credit (multi-answer formats) on non-perfect runs —
 * rewards nearly-mastered material that binary accuracy cannot see.
 */
export const PARTIAL_CREDIT_BONUS = 10;
export const PARTIAL_CREDIT_BONUS_MIN_PERCENT = 80;

/**
 * XP tiers based on accuracy percentage.
 */
export const XP_TIERS = {
  PERFECT: { minAccuracy: 100, xp: BASE_LESSON_XP },
  HIGH: { minAccuracy: 80, xp: BASE_LESSON_XP },
  MEDIUM: { minAccuracy: 50, xp: 30 },
  LOW: { minAccuracy: 0, xp: 10 },
} as const;

/**
 * Inputs for the XP calculation.
 */
export interface XPCalculationInput {
  accuracyPercent: number;
  allCorrectOnFirstAttempt: boolean;
  /** True when any first attempt consumed an adaptivity hint. */
  anyHintUsed?: boolean;
  /** 0..100 average partial score of last attempts (multi-answer formats). */
  partialCreditPercent?: number;
}

/**
 * Calculate XP based on accuracy percentage and first-attempt bonus.
 *
 *  - the perfect bonus only pays in full WITHOUT hints (+10 assisted);
 *  - high partial credit (>=80, non-perfect) pays a +10 mastery bonus.
 */
export function calculateXPFromAccuracy(
  accuracyPercent: number,
  allCorrectOnFirstAttempt: boolean = false,
  hintsOrDetails: boolean | XPCalculationInput = false,
): number {
  const details: XPCalculationInput =
    typeof hintsOrDetails === 'object' && hintsOrDetails !== null
      ? hintsOrDetails
      : { accuracyPercent, allCorrectOnFirstAttempt, anyHintUsed: hintsOrDetails === true };

  let baseXP: number;

  if (accuracyPercent >= XP_TIERS.PERFECT.minAccuracy) {
    baseXP = XP_TIERS.PERFECT.xp;
  } else if (accuracyPercent >= XP_TIERS.HIGH.minAccuracy) {
    baseXP = XP_TIERS.HIGH.xp;
  } else if (accuracyPercent >= XP_TIERS.MEDIUM.minAccuracy) {
    baseXP = XP_TIERS.MEDIUM.xp;
  } else {
    baseXP = XP_TIERS.LOW.xp;
  }

  if (details.allCorrectOnFirstAttempt && accuracyPercent >= 100) {
    return (
      baseXP +
      (details.anyHintUsed ? ASSISTED_PERFECT_FIRST_ATTEMPT_BONUS : PERFECT_FIRST_ATTEMPT_BONUS)
    );
  }

  if (
    typeof details.partialCreditPercent === 'number' &&
    details.partialCreditPercent >= PARTIAL_CREDIT_BONUS_MIN_PERCENT &&
    accuracyPercent < 100
  ) {
    return baseXP + PARTIAL_CREDIT_BONUS;
  }

  return baseXP;
}

/**
 * Get the performance tier name based on accuracy.
 */
export function getPerformanceTier(accuracyPercent: number): string {
  if (accuracyPercent >= XP_TIERS.PERFECT.minAccuracy) return 'perfect';
  if (accuracyPercent >= XP_TIERS.HIGH.minAccuracy) return 'high';
  if (accuracyPercent >= XP_TIERS.MEDIUM.minAccuracy) return 'medium';
  return 'low';
}

/**
 * XP for a completed lesson, derived from its accuracy payload.
 *
 * A lesson without accuracy data pays the base tier without any bonus, which is
 * what the previous strategy did.
 */
export function calculateLessonXp(accuracy?: LessonCompletedPayload['accuracy']): number {
  if (!accuracy) {
    return calculateXPFromAccuracy(XP_TIERS.PERFECT.minAccuracy);
  }

  return calculateXPFromAccuracy(accuracy.accuracyPercent, accuracy.allCorrectOnFirstAttempt, {
    accuracyPercent: accuracy.accuracyPercent,
    allCorrectOnFirstAttempt: accuracy.allCorrectOnFirstAttempt,
    anyHintUsed: accuracy.anyHintUsed ?? false,
    partialCreditPercent: accuracy.partialCreditPercent,
  });
}
