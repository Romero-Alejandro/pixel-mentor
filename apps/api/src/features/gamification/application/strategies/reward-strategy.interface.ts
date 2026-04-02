/**
 * Reward Strategy Interface - Defines the contract for reward strategies.
 */

import type { RewardContext, Reward } from './reward.types';

/**
 * Strategy interface for calculating and generating rewards.
 */
export interface IRewardStrategy {
  /** Unique identifier for this strategy */
  readonly name: string;

  /** Human-readable description of what this strategy does */
  readonly description: string;

  /**
   * Determine if this strategy can apply to the given context.
   */
  canApply(context: RewardContext): Promise<boolean>;

  /**
   * Generate the reward for this strategy.
   */
  getReward(context: RewardContext): Promise<Reward | null>;
}
