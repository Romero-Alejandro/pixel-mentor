/**
 * Strategy Factory - Creates strategy instances based on configuration.
 */

import { createLogger } from '@/shared/logger/logger.js';

import type { IRewardStrategy } from '@/features/gamification/application/strategies/reward-strategy.interface.js';
import type { StrategyConfig } from '@/features/gamification/application/strategies/reward.types.js';

import { LessonCompletionStrategy } from '@/features/gamification/application/strategies/xp-reward.strategy.js';
import {
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
} from '@/features/gamification/application/strategies/badge-reward.strategy.js';
import { StreakBonusStrategy } from '@/features/gamification/application/strategies/streak-bonus.strategy.js';

// Create a logger for strategy factory
const strategyFactoryLogger = createLogger(undefined, { name: 'strategy-factory', level: 'warn' });

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
 */
export function createStrategies(configs: StrategyConfig[]): IRewardStrategy[] {
  const strategies: IRewardStrategy[] = [];

  for (const config of configs) {
    if (!config.enabled) {
      continue;
    }

    const Constructor = STRATEGY_CONSTRUCTORS[config.name];
    if (!Constructor) {
      strategyFactoryLogger.warn(`[StrategyFactory] Unknown strategy: "${config.name}"`);
      continue;
    }

    try {
      const strategy = new Constructor(config.params);
      strategies.push(strategy);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      strategyFactoryLogger.error(
        { err: errorMessage },
        `[StrategyFactory] Failed to create strategy "${config.name}"`,
      );
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
