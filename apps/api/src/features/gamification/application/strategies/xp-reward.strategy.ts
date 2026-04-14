/**
 * XP Reward Strategy - Awards XP for completing lessons based on accuracy.
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';

import type { LessonCompletedPayload } from '@/shared/events/game-events.port';
import { GameDomainEvents } from '@/shared/events/game-events.port';

/**
 * Base XP awarded for completing a lesson.
 */
export const BASE_LESSON_XP = 50;

/**
 * XP bonus for perfect first-attempt accuracy.
 */
export const PERFECT_FIRST_ATTEMPT_BONUS = 20;

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

  if (allCorrectOnFirstAttempt && accuracyPercent >= 100) {
    return baseXP + PERFECT_FIRST_ATTEMPT_BONUS;
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
 * Strategy that awards XP for completing lessons.
 */
export class LessonCompletionStrategy implements IRewardStrategy {
  readonly name = 'LessonCompletionStrategy';
  readonly description =
    'Awards XP for completing lessons based on accuracy with first-attempt bonus (first time only)';

  async canApply(context: RewardContext): Promise<boolean> {
    if (context.event.type !== GameDomainEvents.LESSON_COMPLETED) {
      return false;
    }

    const payload = context.event.payload as LessonCompletedPayload;
    const completedLessonIds = context.metadata.completedLessonIds ?? [];
    const alreadyCompleted = completedLessonIds.includes(payload.lessonId);

    return !alreadyCompleted;
  }

  async getReward(context: RewardContext): Promise<Reward | null> {
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
