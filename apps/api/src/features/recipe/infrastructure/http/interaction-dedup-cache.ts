/**
 * Interaction Deduplication Cache
 *
 * Prevents duplicate processing of SSE interaction requests when
 * fetchEventSource retries after transient network failures.
 *
 * Flow:
 *   1. Frontend generates a unique interactionId per user action
 *   2. Backend checks cache before processing
 *   3. If active (still streaming) → return 409 with dedup info
 *   4. If completed (cached response) → return cached result
 *   5. If unknown → process normally, cache result
 *
 * The cache uses a simple Map with TTL-based expiry to prevent memory leaks.
 */

import { createLogger } from '@/shared/logger/logger.js';

const dedupLogger = createLogger(undefined, { name: 'interaction-dedup', level: 'warn' });

// ---- Constants ----

/** How long to keep completed responses in cache (ms) */
const COMPLETED_TTL_MS = 30_000;

/** How long to track active streams (ms) — should exceed max streaming time */
const ACTIVE_TTL_MS = 120_000;

/** Maximum entries in the cache (prevents memory leaks) */
const MAX_CACHE_ENTRIES = 500;

// ---- Types ----

export type DedupStatus = 'active' | 'completed' | 'unknown';

export interface DedupResult {
  status: DedupStatus;
  /** Present when status is 'completed' */
  cachedResponse?: string;
  /** Present when status is 'active' */
  activeSince?: number;
}

interface CacheEntry {
  /** When this entry was created */
  createdAt: number;
  /** 'active' = stream in progress, 'completed' = response cached */
  status: 'active' | 'completed';
  /** Cached SSE response text (only for completed entries) */
  cachedResponse?: string;
}

// ---- Cache ----

const cache = new Map<string, CacheEntry>();

/**
 * Check if an interactionId was already processed.
 */
export function checkDedup(interactionId: string): DedupResult {
  const entry = cache.get(interactionId);

  if (!entry) {
    return { status: 'unknown' };
  }

  // Check TTL expiry
  const age = Date.now() - entry.createdAt;
  const ttl = entry.status === 'active' ? ACTIVE_TTL_MS : COMPLETED_TTL_MS;

  if (age > ttl) {
    cache.delete(interactionId);
    return { status: 'unknown' };
  }

  if (entry.status === 'active') {
    dedupLogger.info(
      { interactionId, activeSince: entry.createdAt, age },
      '[Dedup] Active stream found, rejecting duplicate',
    );
    return { status: 'active', activeSince: entry.createdAt };
  }

  if (entry.status === 'completed' && entry.cachedResponse !== undefined) {
    dedupLogger.info(
      { interactionId, cachedAt: entry.createdAt, age },
      '[Dedup] Completed stream found, returning cached response',
    );
    return { status: 'completed', cachedResponse: entry.cachedResponse };
  }

  return { status: 'unknown' };
}

/**
 * Mark an interactionId as active (stream in progress).
 */
export function markActive(interactionId: string): void {
  evictIfNeeded();
  cache.set(interactionId, {
    createdAt: Date.now(),
    status: 'active',
  });
}

/**
 * Mark an interactionId as completed and cache the response.
 */
export function markCompleted(interactionId: string, sseResponse: string): void {
  evictIfNeeded();
  cache.set(interactionId, {
    createdAt: Date.now(),
    status: 'completed',
    cachedResponse: sseResponse,
  });
}

/**
 * Mark an interactionId as failed (remove from cache).
 */
export function markFailed(interactionId: string): void {
  cache.delete(interactionId);
}

/**
 * Get cache stats for monitoring.
 */
export function getDedupStats(): { active: number; completed: number; total: number } {
  let active = 0;
  let completed = 0;
  for (const entry of cache.values()) {
    if (entry.status === 'active') active++;
    else completed++;
  }
  return { active, completed, total: cache.size };
}

/**
 * Clear all entries (for testing).
 */
export function clearDedupCache(): void {
  cache.clear();
}

// ---- Internal ----

/**
 * Evict oldest entries if cache is too large.
 */
function evictIfNeeded(): void {
  if (cache.size < MAX_CACHE_ENTRIES) return;

  // Remove oldest 20% of entries
  const toRemove = Math.ceil(MAX_CACHE_ENTRIES * 0.2);
  const entries = Array.from(cache.entries()).sort(([, a], [, b]) => a.createdAt - b.createdAt);

  for (let i = 0; i < toRemove && i < entries.length; i++) {
    cache.delete(entries[i][0]);
  }

  dedupLogger.debug({ removed: toRemove, remaining: cache.size }, '[Dedup] Evicted old entries');
}
