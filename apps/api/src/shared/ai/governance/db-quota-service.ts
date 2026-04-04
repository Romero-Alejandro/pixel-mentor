import type { QuotaCheck } from './governance.types.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import { createLogger } from '@/shared/logger/index.js';

const logger = createLogger(undefined, { name: 'db-quota-service', level: 'warn' });

/**
 * Database-backed Quota service that tracks and enforces per-user LLM usage limits.
 *
 * Uses the User.quota field as the persistent store, with an in-memory cache
 * for performance. The cache is synced to the database periodically.
 *
 * For production with multiple instances, replace with Redis.
 */
export class DatabaseQuotaService {
  /** In-memory cache: Map<userId, remaining> */
  private cache = new Map<string, number>();
  /** Cache expiry timestamps: Map<userId, expiryMs> */
  private cacheExpiry = new Map<string, number>();
  /** Cache TTL in ms (5 minutes) */
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(
    private userRepo: IUserRepository,
    private defaultQuota: number,
  ) {}

  /**
   * Check if a user has remaining quota.
   * Reads from cache first, falls back to database.
   */
  async checkQuota(userId: string): Promise<QuotaCheck> {
    const remaining = await this.getRemainingWithRefresh(userId);
    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'User LLM quota exhausted. Quota resets daily.',
      };
    }
    return { allowed: true, remaining };
  }

  /**
   * Consume one unit of quota for a user.
   * Updates cache immediately and persists to database.
   */
  async consumeQuota(userId: string): Promise<number> {
    const remaining = await this.getRemainingWithRefresh(userId);
    const newRemaining = Math.max(0, remaining - 1);

    // Update cache
    this.cache.set(userId, newRemaining);
    this.cacheExpiry.set(userId, Date.now() + this.cacheTtlMs);

    // Persist to database
    try {
      await this.userRepo.updateQuota(userId, newRemaining);
    } catch (error) {
      logger.warn(
        { userId, error: error instanceof Error ? error.message : String(error) },
        'Failed to persist quota to database',
      );
    }

    return newRemaining;
  }

  /**
   * Set a user's quota explicitly.
   */
  async setQuota(userId: string, quota: number): Promise<void> {
    const finalQuota = Math.max(0, quota);
    this.cache.set(userId, finalQuota);
    this.cacheExpiry.set(userId, Date.now() + this.cacheTtlMs);

    try {
      await this.userRepo.updateQuota(userId, finalQuota);
    } catch (error) {
      logger.warn(
        { userId, error: error instanceof Error ? error.message : String(error) },
        'Failed to persist quota to database',
      );
    }
  }

  /**
   * Get a user's remaining quota without consuming.
   */
  async getRemaining(userId: string): Promise<number> {
    return this.getRemainingWithRefresh(userId);
  }

  /**
   * Reset a user's quota to the default.
   */
  async resetQuota(userId: string): Promise<void> {
    await this.setQuota(userId, this.defaultQuota);
  }

  /**
   * Get remaining quota, refreshing from database if cache is stale.
   */
  private async getRemainingWithRefresh(userId: string): Promise<number> {
    const cached = this.cache.get(userId);
    const expiry = this.cacheExpiry.get(userId);

    if (cached !== undefined && expiry && Date.now() < expiry) {
      return cached;
    }

    // Cache miss or expired - read from database
    try {
      const user = await this.userRepo.findById(userId);
      if (user) {
        const quota = user.quota ?? this.defaultQuota;
        this.cache.set(userId, quota);
        this.cacheExpiry.set(userId, Date.now() + this.cacheTtlMs);
        return quota;
      }
    } catch (error) {
      logger.warn(
        { userId, error: error instanceof Error ? error.message : String(error) },
        'Failed to read quota from database, using default',
      );
    }

    // Fallback to default
    this.cache.set(userId, this.defaultQuota);
    this.cacheExpiry.set(userId, Date.now() + this.cacheTtlMs);
    return this.defaultQuota;
  }

  /**
   * Clear cache (for testing).
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}
