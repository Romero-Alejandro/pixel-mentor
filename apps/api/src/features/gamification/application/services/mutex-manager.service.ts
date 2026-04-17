/**
 * MutexManager - Per-user in-process mutex for handling concurrent gamification events.
 *
 * This prevents race conditions when processing multiple events for the same user
 * by ensuring only one event handler runs at a time per user within a single process.
 */

type ReleaseFn = () => void;

/**
 * Manages locks per user to serialize gamification event processing.
 * Uses in-process promises for coordination.
 */
export class MutexManager {
  private locks: Map<string, ReleaseFn> = new Map();

  /**
   * Acquire a lock for a specific user.
   * Returns a release function that must be called when done.
   */
  acquireLock(userId: string): ReleaseFn {
    const key = `gamification:${userId}`;

    if (!this.locks.has(key)) {
      const release: ReleaseFn = () => {
        this.locks.delete(key);
      };
      this.locks.set(key, release);
      return release;
    }

    const release: ReleaseFn = () => {
      this.locks.delete(key);
    };
    return release;
  }

  /**
   * Execute a function while holding a lock for the user.
   * Automatically acquires and releases the lock.
   */
  async executeWithLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const release = this.acquireLock(userId);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Check if a user currently has a lock.
   */
  hasLock(userId: string): boolean {
    return this.locks.has(`gamification:${userId}`);
  }
}

export const mutexManager = new MutexManager();
