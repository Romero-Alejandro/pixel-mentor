/**
 * Badge Reward Strategies - Award badges based on achievements.
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';

import { GameDomainEvents } from '@/shared/events/game-events.port';

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

  async canApply(context: RewardContext): Promise<boolean> {
    if (context.event.type !== GameDomainEvents.LESSON_COMPLETED) {
      return false;
    }

    const earnedBadges = context.metadata.earnedBadgeCodes ?? [];
    if (earnedBadges.includes(FIRST_LESSON_BADGE_CODE)) {
      return false;
    }

    const profile = context.metadata.profile;
    if (!profile) {
      return true;
    }

    return profile.completedLessons === 0;
  }

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

  async canApply(context: RewardContext): Promise<boolean> {
    const earnedBadges = context.metadata.earnedBadgeCodes ?? [];
    if (earnedBadges.includes(STREAK_7_BADGE_CODE)) {
      return false;
    }

    const profile = context.metadata.profile;
    if (!profile) {
      return false;
    }

    return profile.streak >= 7;
  }

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

  async canApply(context: RewardContext): Promise<boolean> {
    const earnedBadges = context.metadata.earnedBadgeCodes ?? [];
    if (earnedBadges.includes(STREAK_30_BADGE_CODE)) {
      return false;
    }

    const profile = context.metadata.profile;
    if (!profile) {
      return false;
    }

    return profile.streak >= 30;
  }

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
