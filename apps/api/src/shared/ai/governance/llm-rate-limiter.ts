import type { RateLimitCheck } from './governance.types.js';

/**
 * In-memory rate limiter for LLM requests per user.
 *
 * Uses a sliding window approach: tracks timestamps of requests
 * and counts how many fall within the window.
 *
 * For production with multiple instances, replace with Redis.
 */
export class LLMRateLimiter {
  /** Per-user request timestamps: Map<userId, timestamp[]> */
  private userRequests = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number = 60 * 60 * 1000, // 1 hour default
  ) {}

  /**
   * Check if a user is within their rate limit.
   */
  check(userId: string): RateLimitCheck {
    this.cleanupExpired(userId);

    const timestamps = this.userRequests.get(userId) ?? [];
    const remaining = Math.max(0, this.maxRequests - timestamps.length);

    if (timestamps.length >= this.maxRequests) {
      // Calculate when the oldest request will expire
      const oldest = timestamps[0];
      const retryAfterMs = Math.max(0, oldest + this.windowMs - Date.now());
      return {
        allowed: false,
        retryAfterMs,
        remaining: 0,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Record a request for a user.
   */
  recordRequest(userId: string): void {
    const timestamps = this.userRequests.get(userId) ?? [];
    timestamps.push(Date.now());
    this.userRequests.set(userId, timestamps);
  }

  /**
   * Get current request count for a user.
   */
  getRequestCount(userId: string): number {
    this.cleanupExpired(userId);
    return this.userRequests.get(userId)?.length ?? 0;
  }

  /**
   * Get metrics for all users.
   */
  getMetrics(): Record<string, { requests: number; remaining: number }> {
    const metrics: Record<string, { requests: number; remaining: number }> = {};
    for (const [userId, timestamps] of this.userRequests.entries()) {
      metrics[userId] = {
        requests: timestamps.length,
        remaining: Math.max(0, this.maxRequests - timestamps.length),
      };
    }
    return metrics;
  }

  /**
   * Clear all rate limit data (for testing).
   */
  resetAll(): void {
    this.userRequests.clear();
  }

  private cleanupExpired(userId: string): void {
    const timestamps = this.userRequests.get(userId);
    if (!timestamps) return;

    const cutoff = Date.now() - this.windowMs;
    const valid = timestamps.filter((ts) => ts > cutoff);

    if (valid.length !== timestamps.length) {
      this.userRequests.set(userId, valid);
    }
  }
}
