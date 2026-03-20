/**
 * Strategy Module Index - Public API for the reward strategy system.
 *
 * This module exports all strategy-related types, interfaces, and classes
 * for use by the game engine and other modules.
 */

// Types
export type {
  RewardContext,
  Reward,
  RewardType,
  StrategyConfig,
  GameEventPayload,
} from './reward.types';

// Interface
export type { IRewardStrategy } from './reward-strategy.interface';

// Concrete Strategies
export { LessonCompletionStrategy, BASE_LESSON_XP } from './xp-reward.strategy';
export {
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
  FIRST_LESSON_BADGE_CODE,
  STREAK_7_BADGE_CODE,
  STREAK_30_BADGE_CODE,
} from './badge-reward.strategy';
export {
  StreakBonusStrategy,
  STREAK_5_BONUS_XP,
  STREAK_30_BONUS_XP,
  STREAK_THRESHOLD,
  HIGH_STREAK_THRESHOLD,
} from './streak-bonus.strategy';

// Registry & Factory
export { StrategyRegistry, getStrategyRegistry, resetStrategyRegistry } from './strategy-registry';

export {
  createStrategies,
  createDefaultStrategies,
  getAvailableStrategyNames,
} from './strategy-factory';
