import { createLogger } from '@/shared/logger/index.js';
import type { BudgetCheck } from './governance.types.js';

const logger = createLogger(undefined, { name: 'budget-guard', level: 'info' });

/**
 * Budget guard that tracks global daily LLM spending.
 *
 * Uses an in-memory store with daily reset.
 * For production with multiple instances, replace with Redis.
 */
export class BudgetGuard {
  /** Current day's spending in USD */
  private currentSpendUsd = 0;
  /** Day timestamp when the budget was last reset */
  private budgetDayStart: number;

  constructor(private dailyBudgetUsd: number) {
    this.budgetDayStart = this.getStartOfToday();
    this.checkAndResetDay();
  }

  /**
   * Check if there's remaining budget for today.
   */
  checkBudget(): BudgetCheck {
    this.checkAndResetDay();

    if (this.currentSpendUsd >= this.dailyBudgetUsd) {
      return {
        allowed: false,
        currentSpendUsd: this.currentSpendUsd,
        budgetUsd: this.dailyBudgetUsd,
        reason: `Daily LLM budget exhausted ($${this.currentSpendUsd.toFixed(4)} / $${this.dailyBudgetUsd})`,
      };
    }

    return {
      allowed: true,
      currentSpendUsd: this.currentSpendUsd,
      budgetUsd: this.dailyBudgetUsd,
    };
  }

  /**
   * Record a cost against the daily budget.
   * Returns remaining budget after recording.
   */
  recordCost(costUsd: number): number {
    this.checkAndResetDay();

    this.currentSpendUsd += costUsd;

    // Log when approaching budget limit (80% threshold)
    const usagePercent = (this.currentSpendUsd / this.dailyBudgetUsd) * 100;
    if (usagePercent >= 80 && usagePercent < 81) {
      logger.warn(
        { spendUsd: this.currentSpendUsd, budgetUsd: this.dailyBudgetUsd, usagePercent },
        'LLM daily budget approaching limit',
      );
    }

    if (usagePercent >= 100) {
      logger.error(
        { spendUsd: this.currentSpendUsd, budgetUsd: this.dailyBudgetUsd },
        'LLM daily budget exceeded',
      );
    }

    return Math.max(0, this.dailyBudgetUsd - this.currentSpendUsd);
  }

  /**
   * Get current spending metrics.
   */
  getMetrics(): {
    currentSpendUsd: number;
    budgetUsd: number;
    remainingUsd: number;
    usagePercent: number;
  } {
    this.checkAndResetDay();
    return {
      currentSpendUsd: this.currentSpendUsd,
      budgetUsd: this.dailyBudgetUsd,
      remainingUsd: Math.max(0, this.dailyBudgetUsd - this.currentSpendUsd),
      usagePercent: (this.currentSpendUsd / this.dailyBudgetUsd) * 100,
    };
  }

  /**
   * Reset budget (for testing or admin override).
   */
  resetBudget(): void {
    this.currentSpendUsd = 0;
    this.budgetDayStart = Date.now();
  }

  private checkAndResetDay(): void {
    const todayStart = this.getStartOfToday();
    if (todayStart > this.budgetDayStart) {
      logger.info(
        { previousSpend: this.currentSpendUsd, budget: this.dailyBudgetUsd },
        'Daily LLM budget reset',
      );
      this.currentSpendUsd = 0;
      this.budgetDayStart = todayStart;
    }
  }

  private getStartOfToday(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
}
