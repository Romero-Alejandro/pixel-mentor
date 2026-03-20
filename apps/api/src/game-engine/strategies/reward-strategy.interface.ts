/**
 * Reward Strategy Interface - Defines the contract for reward strategies.
 *
 * Following the Strategy Pattern (GoF), this interface allows for:
 * - Flexible reward rules that can be swapped at runtime
 * - Easy addition of new reward types without modifying existing code
 * - Isolated testing of individual reward rules
 *
 * Each strategy is responsible for:
 * 1. Determining if it can apply to a given context (canApply)
 * 2. Generating the reward if applicable (getReward)
 */

import type { RewardContext, Reward } from './reward.types';

/**
 * Strategy interface for calculating and generating rewards.
 *
 * Strategies follow the Single Responsibility Principle - each strategy
 * handles one specific reward rule.
 */
export interface IRewardStrategy {
  /** Unique identifier for this strategy */
  readonly name: string;

  /** Human-readable description of what this strategy does */
  readonly description: string;

  /**
   * Determine if this strategy can apply to the given context.
   *
   * @param context - The evaluation context containing user info and event data
   * @returns Promise<boolean> - true if strategy should be applied, false otherwise
   *
   * @example
   * ```typescript
   * async canApply(context: RewardContext): Promise<boolean> {
   *   // Only apply for lesson completion events
   *   return context.event.type === 'LESSON_COMPLETED';
   * }
   * ```
   */
  canApply(context: RewardContext): Promise<boolean>;

  /**
   * Generate the reward for this strategy.
   *
   * @param context - The evaluation context containing user info and event data
   * @returns Promise<Reward | null> - The reward to apply, or null if not applicable
   *
   * @example
   * ```typescript
   * async getReward(context: RewardContext): Promise<Reward | null> {
   *   return {
   *     type: 'XP',
   *     amount: 50,
   *     description: 'Base XP for completing a lesson'
   *   };
   * }
   * ```
   */
  getReward(context: RewardContext): Promise<Reward | null>;
}
