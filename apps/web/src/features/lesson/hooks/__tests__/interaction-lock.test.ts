import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Lock Implementation (mirrors useClassOrchestrator) ─────────────────────

const INTERACTION_LOCK_TIMEOUT_MS = 30_000;

interface InteractionLock {
  isLocked: boolean;
  acquire(): void;
  release(): void;
  destroy(): void;
}

function createInteractionLock(
  onTimeout?: () => void,
  timeoutMs: number = INTERACTION_LOCK_TIMEOUT_MS,
): InteractionLock {
  let lockTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    isLocked: false,

    acquire() {
      this.isLocked = true;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => {
        if (this.isLocked) {
          this.isLocked = false;
          onTimeout?.();
        }
      }, timeoutMs);
    },

    release() {
      if (lockTimeout) {
        clearTimeout(lockTimeout);
        lockTimeout = null;
      }
      this.isLocked = false;
    },

    destroy() {
      this.release();
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('InteractionLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic acquire/release', () => {
    it('should start unlocked', () => {
      const lock = createInteractionLock();
      expect(lock.isLocked).toBe(false);
      lock.destroy();
    });

    it('should be locked after acquire()', () => {
      const lock = createInteractionLock();
      lock.acquire();
      expect(lock.isLocked).toBe(true);
      lock.destroy();
    });

    it('should be unlocked after release()', () => {
      const lock = createInteractionLock();
      lock.acquire();
      lock.release();
      expect(lock.isLocked).toBe(false);
    });

    it('should allow acquire after release', () => {
      const lock = createInteractionLock();
      lock.acquire();
      lock.release();
      lock.acquire();
      expect(lock.isLocked).toBe(true);
      lock.destroy();
    });
  });

  describe('auto-release timeout', () => {
    it('should auto-release after timeout', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 1000);

      lock.acquire();
      expect(lock.isLocked).toBe(true);

      vi.advanceTimersByTime(1000);

      expect(lock.isLocked).toBe(false);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should not auto-release before timeout', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 1000);

      lock.acquire();
      vi.advanceTimersByTime(999);

      expect(lock.isLocked).toBe(true);
      expect(onTimeout).not.toHaveBeenCalled();

      lock.destroy();
    });

    it('should not call onTimeout if released before timeout', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 1000);

      lock.acquire();
      vi.advanceTimersByTime(500);
      lock.release();

      vi.advanceTimersByTime(600);

      expect(lock.isLocked).toBe(false);
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('should reset timeout on re-acquire', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 1000);

      lock.acquire();
      vi.advanceTimersByTime(500);

      // Re-acquire resets the timeout
      lock.acquire();
      vi.advanceTimersByTime(500);

      // At t=1000, the timeout should NOT have fired yet (reset at t=500)
      expect(lock.isLocked).toBe(true);
      expect(onTimeout).not.toHaveBeenCalled();

      // Now advance to t=1000 after the reset (total 1000ms from reset)
      vi.advanceTimersByTime(500);
      expect(lock.isLocked).toBe(false);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrent access', () => {
    it('should handle rapid acquire/release cycles', () => {
      const lock = createInteractionLock(undefined, 1000);

      for (let i = 0; i < 100; i++) {
        lock.acquire();
        expect(lock.isLocked).toBe(true);
        lock.release();
        expect(lock.isLocked).toBe(false);
      }
    });

    it('should handle double release gracefully', () => {
      const lock = createInteractionLock();
      lock.acquire();
      lock.release();
      lock.release(); // Should not throw
      expect(lock.isLocked).toBe(false);
    });

    it('should handle acquire without prior release', () => {
      const lock = createInteractionLock(undefined, 1000);

      lock.acquire();
      lock.acquire(); // Should reset timeout, not throw

      expect(lock.isLocked).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(lock.isLocked).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should release lock and clear timeout on destroy', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 1000);

      lock.acquire();
      lock.destroy();

      vi.advanceTimersByTime(1000);

      expect(lock.isLocked).toBe(false);
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('should be safe to call destroy multiple times', () => {
      const lock = createInteractionLock();
      lock.acquire();
      lock.destroy();
      lock.destroy(); // Should not throw
    });
  });

  describe('edge cases', () => {
    it('should handle zero timeout', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 0);

      lock.acquire();
      // With 0 timeout, the timeout fires immediately on next tick
      vi.advanceTimersByTime(0);

      expect(lock.isLocked).toBe(false);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should handle very large timeout', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout, 60_000);

      lock.acquire();
      vi.advanceTimersByTime(59_999);

      expect(lock.isLocked).toBe(true);
      expect(onTimeout).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(lock.isLocked).toBe(false);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should not start timeout on release if not acquired', () => {
      const onTimeout = vi.fn();
      const lock = createInteractionLock(onTimeout);

      lock.release(); // Release without acquire
      vi.advanceTimersByTime(30_000);

      expect(onTimeout).not.toHaveBeenCalled();
    });
  });
});
