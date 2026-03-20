/**
 * Streak Bonus Strategy - Awards bonus XP for maintaining streaks.
 *
 * This strategy rewards users who maintain consistent learning streaks
 * with additional XP bonuses that scale with streak length.
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';
import { GameDomainEvents } from '@/events/game-events';

/**
 * Bonus XP for 5+ day streaks.
 */
export const STREAK_5_BONUS_XP = 10;

/**
 * Bonus XP for 30+ day streaks.
 */
export const STREAK_30_BONUS_XP = 25;

/**
 * Minimum streak length required for bonus.
 */
export const STREAK_THRESHOLD = 5;

/**
 * Higher streak threshold for larger bonus.
 */
export const HIGH_STREAK_THRESHOLD = 30;

/**
 * Strategy that awards bonus XP for maintaining streaks.
 */
export class StreakBonusStrategy implements IRewardStrategy {
  readonly name = 'StreakBonusStrategy';
  readonly description =
    'Awards bonus XP for maintaining streaks (5+ days = +10 XP, 30+ days = +25 XP)';

  /**
   * Determines if this strategy applies.
   *
   * Applies when:
   * - The event is a DAILY_LOGIN event
   * - The user has a streak of 5 or more days
   */
  async canApply(context: RewardContext): Promise<boolean> {
    if (context.event.type !== GameDomainEvents.DAILY_LOGIN) {
      return false;
    }

    const profile = context.metadata.profile;
    if (!profile) {
      return false;
    }

    // Must have a streak of at least 5 days
    return profile.streak >= STREAK_THRESHOLD;
  }

  /**
   * Generates the streak bonus XP reward.
   *
   * Bonus scales with streak length:
   * - 5-29 days: +10 XP
   * - 30+ days: +25 XP (higher tier bonus)
   */
  async getReward(context: RewardContext): Promise<Reward | null> {
    if (!(await this.canApply(context))) {
      return null;
    }

    const profile = context.metadata.profile!;
    let bonusXP: number;
    let description: string;

    // Determine bonus based on streak tier
    if (profile.streak >= HIGH_STREAK_THRESHOLD) {
      bonusXP = STREAK_30_BONUS_XP;
      description = `Streak bonus for ${profile.streak}-day streak (+${bonusXP} XP)`;
    } else {
      bonusXP = STREAK_5_BONUS_XP;
      description = `Streak bonus for ${profile.streak}-day streak (+${bonusXP} XP)`;
    }

    return {
      type: 'STREAK_BONUS',
      amount: bonusXP,
      description,
    };
  }
}
