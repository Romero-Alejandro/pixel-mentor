import type { QuotaCheck } from './governance.types.js';

/**
 * Quota service that tracks and enforces per-user LLM usage limits.
 *
 * Uses an in-memory store for simplicity. For production with multiple
 * instances, replace with Redis or database-backed counters.
 */
export class QuotaService {
  /** Per-user remaining quota: Map<userId, remaining> */
  private userQuotas = new Map<string, number>();
  /** Per-user quota reset time: Map<userId, resetTimestamp> */
  private quotaResets = new Map<string, number>();

  constructor(
    private defaultQuota: number,
    private resetIntervalMs: number = 24 * 60 * 60 * 1000, // 24h default
  ) {}

  /**
   * Check if a user has remaining quota.
   */
  checkQuota(userId: string): QuotaCheck {
    this.ensureQuotaInitialized(userId);
    this.checkAndResetIfExpired(userId);

    const remaining = this.userQuotas.get(userId) ?? 0;
    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        reason:
          'User LLM quota exhausted. Quota resets in ' + this.getResetTimeRemaining(userId) + 'ms',
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Consume one unit of quota for a user.
   * Returns remaining quota after consumption.
   */
  consumeQuota(userId: string): number {
    this.ensureQuotaInitialized(userId);
    this.checkAndResetIfExpired(userId);

    const current = this.userQuotas.get(userId) ?? 0;
    const remaining = Math.max(0, current - 1);
    this.userQuotas.set(userId, remaining);
    return remaining;
  }

  /**
   * Set a user's quota explicitly.
   */
  setQuota(userId: string, quota: number): void {
    this.userQuotas.set(userId, Math.max(0, quota));
    this.quotaResets.set(userId, Date.now() + this.resetIntervalMs);
  }

  /**
   * Get a user's remaining quota without consuming.
   */
  getRemaining(userId: string): number {
    this.ensureQuotaInitialized(userId);
    return this.userQuotas.get(userId) ?? 0;
  }

  /**
   * Reset a user's quota to the default.
   */
  resetQuota(userId: string): void {
    this.userQuotas.set(userId, this.defaultQuota);
    this.quotaResets.set(userId, Date.now() + this.resetIntervalMs);
  }

  /**
   * Get metrics for all users (for monitoring/admin).
   */
  getMetrics(): Record<string, { remaining: number; resetInMs: number }> {
    const metrics: Record<string, { remaining: number; resetInMs: number }> = {};
    for (const [userId, remaining] of this.userQuotas.entries()) {
      metrics[userId] = {
        remaining,
        resetInMs: Math.max(0, (this.quotaResets.get(userId) ?? 0) - Date.now()),
      };
    }
    return metrics;
  }

  /**
   * Clear all quotas (for testing).
   */
  resetAll(): void {
    this.userQuotas.clear();
    this.quotaResets.clear();
  }

  private ensureQuotaInitialized(userId: string): void {
    if (!this.userQuotas.has(userId)) {
      this.userQuotas.set(userId, this.defaultQuota);
      this.quotaResets.set(userId, Date.now() + this.resetIntervalMs);
    }
  }

  private checkAndResetIfExpired(userId: string): void {
    const resetTime = this.quotaResets.get(userId);
    if (resetTime && Date.now() >= resetTime) {
      this.userQuotas.set(userId, this.defaultQuota);
      this.quotaResets.set(userId, Date.now() + this.resetIntervalMs);
    }
  }

  private getResetTimeRemaining(userId: string): number {
    const resetTime = this.quotaResets.get(userId);
    if (!resetTime) return 0;
    return Math.max(0, resetTime - Date.now());
  }
}
