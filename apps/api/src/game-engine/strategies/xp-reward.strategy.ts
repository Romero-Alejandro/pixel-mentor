/**
 * XP Reward Strategy - Awards base XP for completing lessons.
 *
 * This strategy provides the foundational XP reward for lesson completion,
 * serving as the baseline from which streak bonuses and other modifiers build upon.
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';
import { GameDomainEvents } from '@/events/game-events';

/**
 * Base XP awarded for completing a lesson.
 */
export const BASE_LESSON_XP = 50;

/**
 * Strategy that awards XP for completing lessons.
 */
export class LessonCompletionStrategy implements IRewardStrategy {
  readonly name = 'LessonCompletionStrategy';
  readonly description = 'Awards base XP for completing lessons';

  /**
   * Determines if this strategy applies to the given context.
   *
   * Applies when:
   * - The event is a LESSON_COMPLETED event
   */
  async canApply(context: RewardContext): Promise<boolean> {
    return context.event.type === GameDomainEvents.LESSON_COMPLETED;
  }

  /**
   * Generates the XP reward for lesson completion.
   *
   * @returns Reward with 50 XP for completing a lesson
   */
  async getReward(context: RewardContext): Promise<Reward | null> {
    // Double-check that we should apply
    if (!(await this.canApply(context))) {
      return null;
    }

    return {
      type: 'XP',
      amount: BASE_LESSON_XP,
      description: `Base XP for completing a lesson (${BASE_LESSON_XP} XP)`,
    };
  }
}
