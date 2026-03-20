/**
 * Strategy Factory - Creates strategy instances based on configuration.
 *
 * The factory provides a way to:
 * - Create strategy instances from configuration
 * - Enable/disable strategies based on configuration
 * - Inject custom parameters into strategies
 *
 * This follows the Factory Method Pattern and enables
 * configuration-driven strategy instantiation.
 */

import type { IRewardStrategy } from './reward-strategy.interface';
import type { StrategyConfig } from './reward.types';

// Import concrete strategies
import { LessonCompletionStrategy } from './xp-reward.strategy';
import {
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
} from './badge-reward.strategy';
import { StreakBonusStrategy } from './streak-bonus.strategy';

/**
 * Mapping of strategy names to their constructor functions.
 */
type StrategyConstructor = new (params?: Record<string, unknown>) => IRewardStrategy;

const STRATEGY_CONSTRUCTORS: Record<string, StrategyConstructor> = {
  LessonCompletionStrategy,
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
  StreakBonusStrategy,
};

/**
 * Create strategy instances based on configuration.
 *
 * @param configs - Array of strategy configurations
 * @returns Array of instantiated strategies (only enabled ones)
 *
 * @example
 * ```typescript
 * const strategies = createStrategies([
 *   { name: 'LessonCompletionStrategy', enabled: true },
 *   { name: 'FirstLessonBadgeStrategy', enabled: true },
 *   { name: 'StreakBonusStrategy', enabled: false },
 * ]);
 * ```
 */
export function createStrategies(configs: StrategyConfig[]): IRewardStrategy[] {
  const strategies: IRewardStrategy[] = [];

  for (const config of configs) {
    if (!config.enabled) {
      continue;
    }

    const Constructor = STRATEGY_CONSTRUCTORS[config.name];
    if (!Constructor) {
      console.warn(`[StrategyFactory] Unknown strategy: "${config.name}"`);
      continue;
    }

    try {
      const strategy = new Constructor(config.params);
      strategies.push(strategy);
    } catch (error) {
      console.error(`[StrategyFactory] Failed to create strategy "${config.name}":`, error);
    }
  }

  return strategies;
}

/**
 * Get all available strategy names.
 */
export function getAvailableStrategyNames(): string[] {
  return Object.keys(STRATEGY_CONSTRUCTORS);
}

/**
 * Create all default strategies (all enabled, no custom params).
 */
export function createDefaultStrategies(): IRewardStrategy[] {
  const strategyNames = getAvailableStrategyNames();
  return createStrategies(
    strategyNames.map((name) => ({
      name,
      enabled: true,
    })),
  );
}
