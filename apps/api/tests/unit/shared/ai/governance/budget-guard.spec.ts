/**
 * Unit Tests for BudgetGuard
 *
 * Tests cover:
 * - Allows spending within budget
 * - Blocks when budget exceeded
 * - recordCost tracks spending
 * - getMetrics returns correct percentages
 * - Daily reset works (mock Date.now)
 * - resetBudget clears spending
 */

import { BudgetGuard } from '@/shared/ai/governance/budget-guard.js';

describe('BudgetGuard', () => {
  let budgetGuard: BudgetGuard;
  const DAILY_BUDGET = 10; // $10

  beforeEach(() => {
    budgetGuard = new BudgetGuard(DAILY_BUDGET);
  });

  describe('checkBudget', () => {
    it('should allow when no costs have been recorded', () => {
      const result = budgetGuard.checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.currentSpendUsd).toBe(0);
      expect(result.budgetUsd).toBe(DAILY_BUDGET);
      expect(result.reason).toBeUndefined();
    });

    it('should allow when spending is within budget', () => {
      budgetGuard.recordCost(3);

      const result = budgetGuard.checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.currentSpendUsd).toBe(3);
    });

    it('should block when spending equals budget', () => {
      budgetGuard.recordCost(DAILY_BUDGET);

      const result = budgetGuard.checkBudget();

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exhausted');
    });

    it('should block when spending exceeds budget', () => {
      budgetGuard.recordCost(DAILY_BUDGET + 5);

      const result = budgetGuard.checkBudget();

      expect(result.allowed).toBe(false);
    });
  });

  describe('recordCost', () => {
    it('should track spending correctly', () => {
      budgetGuard.recordCost(2);
      budgetGuard.recordCost(3);

      const metrics = budgetGuard.getMetrics();

      expect(metrics.currentSpendUsd).toBe(5);
    });

    it('should return remaining budget after recording', () => {
      const remaining = budgetGuard.recordCost(3);

      expect(remaining).toBe(DAILY_BUDGET - 3);
    });

    it('should not return negative remaining', () => {
      const remaining = budgetGuard.recordCost(DAILY_BUDGET + 10);

      expect(remaining).toBe(0);
    });

    it('should handle very small costs', () => {
      budgetGuard.recordCost(0.0001);

      const metrics = budgetGuard.getMetrics();
      expect(metrics.currentSpendUsd).toBeCloseTo(0.0001, 4);
    });

    it('should handle zero cost', () => {
      budgetGuard.recordCost(0);

      const metrics = budgetGuard.getMetrics();
      expect(metrics.currentSpendUsd).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return correct metrics with no spending', () => {
      const metrics = budgetGuard.getMetrics();

      expect(metrics.currentSpendUsd).toBe(0);
      expect(metrics.budgetUsd).toBe(DAILY_BUDGET);
      expect(metrics.remainingUsd).toBe(DAILY_BUDGET);
      expect(metrics.usagePercent).toBe(0);
    });

    it('should return correct metrics after spending', () => {
      budgetGuard.recordCost(2.5);

      const metrics = budgetGuard.getMetrics();

      expect(metrics.currentSpendUsd).toBe(2.5);
      expect(metrics.budgetUsd).toBe(DAILY_BUDGET);
      expect(metrics.remainingUsd).toBe(DAILY_BUDGET - 2.5);
      expect(metrics.usagePercent).toBe(25);
    });

    it('should return 100% usage when budget is fully spent', () => {
      budgetGuard.recordCost(DAILY_BUDGET);

      const metrics = budgetGuard.getMetrics();

      expect(metrics.usagePercent).toBe(100);
      expect(metrics.remainingUsd).toBe(0);
    });

    it('should return over 100% usage when budget is exceeded', () => {
      budgetGuard.recordCost(DAILY_BUDGET * 1.5);

      const metrics = budgetGuard.getMetrics();

      expect(metrics.usagePercent).toBe(150);
      expect(metrics.remainingUsd).toBe(0);
    });
  });

  describe('daily reset', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should reset spending when a new day starts', () => {
      jest.useFakeTimers();
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);
      // Create BudgetGuard AFTER fake timers so budgetDayStart aligns
      const guard = new BudgetGuard(DAILY_BUDGET);
      guard.recordCost(5);
      expect(guard.getMetrics().currentSpendUsd).toBe(5);

      // Advance to the next day (past midnight)
      const nextDay = new Date(baseTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      jest.setSystemTime(nextDay.getTime());

      const result = guard.checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.currentSpendUsd).toBe(0);
    });

    it('should not reset spending within the same day', () => {
      jest.useFakeTimers();
      // Use a fixed time early in the day so +12h stays within the same calendar day
      const baseTime = new Date(2026, 0, 15, 6, 0, 0).getTime(); // Jan 15 2026 06:00:00
      jest.setSystemTime(baseTime);
      const guard = new BudgetGuard(DAILY_BUDGET);

      guard.recordCost(3);

      // Advance 12 hours (same day — 06:00 → 18:00)
      jest.setSystemTime(baseTime + 12 * 60 * 60 * 1000);

      const metrics = guard.getMetrics();
      expect(metrics.currentSpendUsd).toBe(3);
    });

    it('should allow spending again after daily reset', () => {
      jest.useFakeTimers();
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);
      const guard = new BudgetGuard(DAILY_BUDGET);

      // Exhaust the budget
      guard.recordCost(DAILY_BUDGET);
      expect(guard.checkBudget().allowed).toBe(false);

      // Advance to next day
      const nextDay = new Date(baseTime);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      jest.setSystemTime(nextDay.getTime());

      // Should be allowed again
      const result = guard.checkBudget();
      expect(result.allowed).toBe(true);
      expect(result.budgetUsd).toBe(DAILY_BUDGET);
    });
  });

  describe('resetBudget', () => {
    it('should clear all spending', () => {
      budgetGuard.recordCost(7);
      budgetGuard.resetBudget();

      const metrics = budgetGuard.getMetrics();
      expect(metrics.currentSpendUsd).toBe(0);
      expect(metrics.remainingUsd).toBe(DAILY_BUDGET);
    });

    it('should allow spending again after reset', () => {
      budgetGuard.recordCost(DAILY_BUDGET);
      expect(budgetGuard.checkBudget().allowed).toBe(false);

      budgetGuard.resetBudget();

      expect(budgetGuard.checkBudget().allowed).toBe(true);
    });

    it('should reset usage percentage to 0', () => {
      budgetGuard.recordCost(5);
      budgetGuard.resetBudget();

      const metrics = budgetGuard.getMetrics();
      expect(metrics.usagePercent).toBe(0);
    });
  });
});
