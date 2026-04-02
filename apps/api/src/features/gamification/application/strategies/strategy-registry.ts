/**
 * Strategy Registry - Manages all registered reward strategies.
 */

import { createLogger } from '@/shared/logger/logger.js';

import type { IRewardStrategy } from './reward-strategy.interface';
import type { RewardContext, Reward } from './reward.types';

/**
 * Result of executing strategies for a context.
 */
export interface StrategyExecutionResult {
  rewards: Reward[];
  totalXP: number;
  totalStreakBonus: number;
  badgesToAward: Array<{
    code: string;
    name: string;
    icon: string;
    description: string;
  }>;
  executedStrategies: string[];
}

/**
 * Registry for managing reward strategies.
 */
export class StrategyRegistry {
  private strategies = new Map<string, IRewardStrategy>();
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(logger?: ReturnType<typeof createLogger>) {
    this.logger = logger ?? createLogger();
  }

  register(strategy: IRewardStrategy): void {
    if (this.strategies.has(strategy.name)) {
      throw new Error(`Strategy with name "${strategy.name}" is already registered`);
    }
    this.strategies.set(strategy.name, strategy);
    this.logger.debug(`[StrategyRegistry] Registered strategy: ${strategy.name}`);
  }

  unregister(name: string): boolean {
    return this.strategies.delete(name);
  }

  findByName(name: string): IRewardStrategy | undefined {
    return this.strategies.get(name);
  }

  getStrategies(): IRewardStrategy[] {
    return Array.from(this.strategies.values());
  }

  get count(): number {
    return this.strategies.size;
  }

  has(name: string): boolean {
    return this.strategies.has(name);
  }

  clear(): void {
    this.strategies.clear();
  }

  replace(strategy: IRewardStrategy): void {
    if (!this.strategies.has(strategy.name)) {
      throw new Error(`Strategy "${strategy.name}" not found in registry`);
    }
    this.strategies.set(strategy.name, strategy);
  }

  async execute(context: RewardContext): Promise<StrategyExecutionResult> {
    const rewards: Reward[] = [];
    const executedStrategies: string[] = [];
    const badgeMap = new Map<string, { name: string; icon: string; description: string }>();

    this.logger.debug(
      `[StrategyRegistry] Executing strategies for ${context.userId} on ${context.event.type}`,
    );

    for (const strategy of this.strategies.values()) {
      try {
        const canApply = await strategy.canApply(context);
        if (canApply) {
          this.logger.debug(`[StrategyRegistry] Strategy ${strategy.name} applies, getting reward`);
          const reward = await strategy.getReward(context);
          if (reward) {
            rewards.push(reward);
            executedStrategies.push(strategy.name);

            if (reward.type === 'BADGE' && reward.badgeCode) {
              if (!badgeMap.has(reward.badgeCode)) {
                badgeMap.set(reward.badgeCode, {
                  name: reward.badgeName ?? reward.badgeCode,
                  icon: reward.badgeIcon ?? '🏆',
                  description: reward.description,
                });
              }
            }
          }
        }
      } catch (error) {
        this.logger.error(
          { err: error },
          `[StrategyRegistry] Error executing strategy ${strategy.name}`,
        );
      }
    }

    const totalXP = rewards
      .filter((r) => r.type === 'XP')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const totalStreakBonus = rewards
      .filter((r) => r.type === 'STREAK_BONUS')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);

    return {
      rewards,
      totalXP,
      totalStreakBonus,
      badgesToAward: Array.from(badgeMap.entries()).map(([code, data]) => ({
        code,
        ...data,
      })),
      executedStrategies,
    };
  }
}

// Singleton instance
let registryInstance: StrategyRegistry | null = null;

export function getStrategyRegistry(): StrategyRegistry {
  if (!registryInstance) {
    registryInstance = new StrategyRegistry();
  }
  return registryInstance;
}

export function resetStrategyRegistry(): void {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = null;
}
