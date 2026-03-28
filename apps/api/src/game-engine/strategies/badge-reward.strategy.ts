/**
 * Badge Reward Strategies - Award badges based on achievements.
 *
 * These strategies handle badge-specific reward rules including:
 * - First lesson completion badge
 * - Streak milestone badges (7 days, 30 days)
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';

import { GameDomainEvents } from '@/events/game-events';

/**
 * Badge codes for first lesson achievement.
 */
export const FIRST_LESSON_BADGE_CODE = 'FIRST_LESSON';

/**
 * Badge codes for streak milestones.
 */
export const STREAK_7_BADGE_CODE = 'STREAK_7';
export const STREAK_30_BADGE_CODE = 'STREAK_30';

/**
 * Strategy that awards the "First Lesson" badge on first completion.
 */
export class FirstLessonBadgeStrategy implements IRewardStrategy {
  readonly name = 'FirstLessonBadgeStrategy';
  readonly description = 'Awards the first lesson badge on first completion';

  /**
   * Determines if this strategy applies.
   *
   * Applies when:
   * - The event is a LESSON_COMPLETED event
   * - The user hasn't earned the FIRST_LESSON badge yet
   */
  async canApply(context: RewardContext): Promise<boolean> {
    if (context.event.type !== GameDomainEvents.LESSON_COMPLETED) {
      return false;
    }

    // Don't apply if user already has the badge
    const earnedBadges = context.metadata.earnedBadgeCodes ?? [];
    if (earnedBadges.includes(FIRST_LESSON_BADGE_CODE)) {
      return false;
    }

    // Check if this is the user's first lesson
    const profile = context.metadata.profile;
    if (!profile) {
      // If no profile data, assume this is the first lesson
      return true;
    }

    // First lesson badge is for the very first lesson
    return profile.completedLessons === 0;
  }

  /**
   * Generates the first lesson badge reward.
   */
  async getReward(context: RewardContext): Promise<Reward | null> {
    if (!(await this.canApply(context))) {
      return null;
    }

    return {
      type: 'BADGE',
      badgeCode: FIRST_LESSON_BADGE_CODE,
      badgeName: 'Primera Lección',
      badgeIcon: '🌱',
      description: 'Awarded for completing your first lesson',
    };
  }
}

/**
 * Strategy that awards the 7-day streak badge.
 */
export class StreakMilestone7Strategy implements IRewardStrategy {
  readonly name = 'StreakMilestone7Strategy';
  readonly description = 'Awards the 7-day streak badge';

  /**
   * Determines if this strategy applies.
   *
   * Applies when:
   * - The user has reached a 7-day streak
   * - The user hasn't earned the STREAK_7 badge yet
   */
  async canApply(context: RewardContext): Promise<boolean> {
    // Check if user already has the badge
    const earnedBadges = context.metadata.earnedBadgeCodes ?? [];
    if (earnedBadges.includes(STREAK_7_BADGE_CODE)) {
      return false;
    }

    // Check if streak is exactly 7 or crossed 7
    const profile = context.metadata.profile;
    if (!profile) {
      return false;
    }

    return profile.streak >= 7;
  }

  /**
   * Generates the 7-day streak badge reward.
   */
  async getReward(context: RewardContext): Promise<Reward | null> {
    if (!(await this.canApply(context))) {
      return null;
    }

    return {
      type: 'BADGE',
      badgeCode: STREAK_7_BADGE_CODE,
      badgeName: 'Racha de 7',
      badgeIcon: '🔥',
      description: 'Awarded for maintaining a 7-day learning streak',
    };
  }
}

/**
 * Strategy that awards the 30-day streak badge.
 */
export class StreakMilestone30Strategy implements IRewardStrategy {
  readonly name = 'StreakMilestone30Strategy';
  readonly description = 'Awards the 30-day streak badge';

  /**
   * Determines if this strategy applies.
   *
   * Applies when:
   * - The user has reached a 30-day streak
   * - The user hasn't earned the STREAK_30 badge yet
   */
  async canApply(context: RewardContext): Promise<boolean> {
    // Check if user already has the badge
    const earnedBadges = context.metadata.earnedBadgeCodes ?? [];
    if (earnedBadges.includes(STREAK_30_BADGE_CODE)) {
      return false;
    }

    // Check if streak is exactly 30 or crossed 30
    const profile = context.metadata.profile;
    if (!profile) {
      return false;
    }

    return profile.streak >= 30;
  }

  /**
   * Generates the 30-day streak badge reward.
   */
  async getReward(context: RewardContext): Promise<Reward | null> {
    if (!(await this.canApply(context))) {
      return null;
    }

    return {
      type: 'BADGE',
      badgeCode: STREAK_30_BADGE_CODE,
      badgeName: 'Racha de 30',
      badgeIcon: '🔥',
      description: 'Awarded for maintaining a 30-day learning streak',
    };
  }
}
