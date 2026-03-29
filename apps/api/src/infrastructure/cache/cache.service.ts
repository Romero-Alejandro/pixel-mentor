/**
 * Cache Service
 *
 * Provides in-memory caching with TTL (Time To Live) support.
 * Useful for caching frequently accessed data like:
 * - User gamification profiles
 * - Badge definitions
 * - Level configurations
 *
 * @example
 * ```typescript
 * const cache = getCacheService();
 *
 * // Set with TTL (5 minutes)
 * await cache.set('user:123:profile', userData, 300);
 *
 * // Get cached value
 * const user = await cache.get<UserProfile>('user:123:profile');
 *
 * // Delete cached value
 * await cache.delete('user:123:profile');
 * ```
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  /** Default TTL in seconds */
  defaultTTL?: number;
  /** Maximum number of entries */
  maxSize?: number;
  /** Cleanup interval in seconds */
  cleanupInterval?: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.defaultTTL ?? 300; // 5 minutes
    this.maxSize = options.maxSize ?? 1000;

    // Start cleanup interval
    const cleanupInterval = (options.cleanupInterval ?? 60) * 1000; // Convert to ms
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval);
  }

  /**
   * Get a cached value by key
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a cached value with optional TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const ttl = ttlSeconds ?? this.defaultTTL;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get or set a cached value (cache-through)
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Delete a cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries when at capacity
   */
  private evictOldest(): void {
    // Remove oldest 10% of entries
    const entriesToRemove = Math.ceil(this.maxSize * 0.1);
    const entries = Array.from(this.cache.entries());

    // Sort by expiration time (oldest first)
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Destroy the cache service (cleanup timer)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// ==================== Singleton Instance ====================

let cacheServiceInstance: CacheService | null = null;

/**
 * Get the singleton CacheService instance
 */
export function getCacheService(options?: CacheOptions): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(options);
  }
  return cacheServiceInstance;
}

/**
 * Reset the cache service (for testing)
 */
export function resetCacheService(): void {
  if (cacheServiceInstance) {
    cacheServiceInstance.destroy();
    cacheServiceInstance = null;
  }
}
