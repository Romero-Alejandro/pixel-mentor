/**
 * XP Reward Strategy - Awards XP for completing lessons based on accuracy.
 *
 * This strategy provides XP rewards that scale based on the student's performance:
 * - 100% correct (last attempt) + all first attempts correct = 70 XP (50 base + 20 bonus)
 * - 100% correct (last attempt) = 50 XP (base, no bonus)
 * - 80-99% correct = 50 XP (base)
 * - 50-79% correct = 30 XP (reduced)
 * - <50% correct = 10 XP (minimum)
 *
 * The 20 XP bonus is only awarded if ALL answers were correct on the FIRST attempt.
 * This rewards students who understand immediately while still recognizing eventual mastery.
 *
 * IMPORTANT: XP is only awarded on the FIRST completion of a lesson.
 * Repeating a lesson does NOT grant additional XP (to prevent XP farming).
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';
import type { LessonCompletedPayload } from '@/events/game-events';
import { GameDomainEvents } from '@/events/game-events';

/**
 * Base XP awarded for completing a lesson.
 */
export const BASE_LESSON_XP = 50;

/**
 * XP bonus for perfect first-attempt accuracy (all correct on first try).
 */
export const PERFECT_FIRST_ATTEMPT_BONUS = 20;

/**
 * XP tiers based on accuracy percentage (last attempt).
 */
export const XP_TIERS = {
  PERFECT: { minAccuracy: 100, xp: BASE_LESSON_XP }, // 50 XP (bonus applied separately)
  HIGH: { minAccuracy: 80, xp: BASE_LESSON_XP }, // 50 XP
  MEDIUM: { minAccuracy: 50, xp: 30 }, // 30 XP
  LOW: { minAccuracy: 0, xp: 10 }, // 10 XP
} as const;

/**
 * Calculate XP based on accuracy percentage and first-attempt bonus.
 */
export function calculateXPFromAccuracy(
  accuracyPercent: number,
  allCorrectOnFirstAttempt: boolean = false,
): number {
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

  // Add bonus only if all correct on first attempt
  if (allCorrectOnFirstAttempt && accuracyPercent >= 100) {
    return baseXP + PERFECT_FIRST_ATTEMPT_BONUS;
  }

  return baseXP;
}

/**
 * Get the performance tier name based on accuracy.
 */
export function getPerformanceTier(accuracyPercent: number): string {
  if (accuracyPercent >= XP_TIERS.PERFECT.minAccuracy) {
    return 'perfect';
  }
  if (accuracyPercent >= XP_TIERS.HIGH.minAccuracy) {
    return 'high';
  }
  if (accuracyPercent >= XP_TIERS.MEDIUM.minAccuracy) {
    return 'medium';
  }
  return 'low';
}

/**
 * Strategy that awards XP for completing lessons.
 * XP scales based on accuracy (last attempt) with bonus for first-attempt perfection.
 * Only awards XP on the FIRST completion of each lesson.
 */
export class LessonCompletionStrategy implements IRewardStrategy {
  readonly name = 'LessonCompletionStrategy';
  readonly description =
    'Awards XP for completing lessons based on accuracy with first-attempt bonus (first time only)';

  /**
   * Determines if this strategy applies to the given context.
   *
   * Applies when:
   * - The event is a LESSON_COMPLETED event
   * - The lesson has NOT been completed before (not in completedLessonIds)
   */
  async canApply(context: RewardContext): Promise<boolean> {
    if (context.event.type !== GameDomainEvents.LESSON_COMPLETED) {
      return false;
    }

    // Check if this lesson was already completed (MASTERED)
    const payload = context.event.payload as LessonCompletedPayload;
    const completedLessonIds = context.metadata.completedLessonIds ?? [];
    const alreadyCompleted = completedLessonIds.includes(payload.lessonId);

    // Only award XP on first completion
    return !alreadyCompleted;
  }

  /**
   * Generates the XP reward for lesson completion based on accuracy.
   *
   * @returns Reward with scaled XP based on accuracy and first-attempt bonus,
   *          or null if the lesson was already completed
   */
  async getReward(context: RewardContext): Promise<Reward | null> {
    // Double-check that we should apply
    if (!(await this.canApply(context))) {
      return null;
    }

    const payload = context.event.payload as LessonCompletedPayload;
    const accuracyPercent = payload.accuracy?.accuracyPercent ?? 100;
    const allCorrectOnFirstAttempt = payload.accuracy?.allCorrectOnFirstAttempt ?? false;
    const xpAmount = calculateXPFromAccuracy(accuracyPercent, allCorrectOnFirstAttempt);
    const tier = getPerformanceTier(accuracyPercent);
    const hasBonus = allCorrectOnFirstAttempt && accuracyPercent >= 100;

    let description = `XP por completar lección (${accuracyPercent}% precisión, tier: ${tier})`;
    if (hasBonus) {
      description += ` + bonus primer intento (+${PERFECT_FIRST_ATTEMPT_BONUS} XP)`;
    }

    return {
      type: 'XP',
      amount: xpAmount,
      description,
    };
  }
}
