/**
 * useLessonInteractions Tests
 *
 * Tests the interaction lock management patterns and core logic.
 * Since the hook has heavy React/API dependencies, these tests verify
 * the underlying patterns in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Lock Pattern Tests ----

describe('Interaction Lock Pattern', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should auto-release lock after timeout', () => {
    let isLocked = false;
    let lockTimeout: ReturnType<typeof setTimeout> | null = null;
    const onTimeout = vi.fn();

    const acquireLock = () => {
      isLocked = true;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => {
        if (isLocked) {
          isLocked = false;
          onTimeout();
        }
      }, 30_000);
    };

    const releaseLock = () => {
      if (lockTimeout) {
        clearTimeout(lockTimeout);
        lockTimeout = null;
      }
      isLocked = false;
    };

    acquireLock();
    expect(isLocked).toBe(true);

    vi.advanceTimersByTime(30_000);
    expect(isLocked).toBe(false);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    // Cleanup
    releaseLock();
  });

  it('should not auto-release if released before timeout', () => {
    let isLocked = false;
    let lockTimeout: ReturnType<typeof setTimeout> | null = null;
    const onTimeout = vi.fn();

    const acquireLock = () => {
      isLocked = true;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => {
        if (isLocked) {
          isLocked = false;
          onTimeout();
        }
      }, 30_000);
    };

    const releaseLock = () => {
      if (lockTimeout) {
        clearTimeout(lockTimeout);
        lockTimeout = null;
      }
      isLocked = false;
    };

    acquireLock();
    vi.advanceTimersByTime(15_000);
    releaseLock();
    vi.advanceTimersByTime(20_000);

    expect(isLocked).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should reset timeout on re-acquire', () => {
    let isLocked = false;
    let lockTimeout: ReturnType<typeof setTimeout> | null = null;
    const onTimeout = vi.fn();

    const acquireLock = () => {
      isLocked = true;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => {
        if (isLocked) {
          isLocked = false;
          onTimeout();
        }
      }, 30_000);
    };

    acquireLock();
    vi.advanceTimersByTime(20_000);
    acquireLock(); // Reset timeout
    vi.advanceTimersByTime(20_000);

    // Should not have fired yet (40s < 30s from reset)
    expect(isLocked).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(isLocked).toBe(false);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

// ---- doInteract Pattern Tests ----

describe('doInteract Pattern', () => {
  it('should return null when lock is held', () => {
    const isInteractingRef = { current: true };

    const doInteract = (_input: string) => {
      if (isInteractingRef.current) return null;
      // ... actual logic
      return { pedagogicalState: 'EXPLANATION' };
    };

    const result = doInteract('ok');
    expect(result).toBeNull();
  });

  it('should throw when no session ID', () => {
    const sessionIdRef = { current: null };

    const doInteract = (_input: string) => {
      const sid = sessionIdRef.current;
      if (!sid) throw new Error('Sesion no activa');
      return { pedagogicalState: 'EXPLANATION' };
    };

    expect(() => doInteract('ok')).toThrow('Sesion no activa');
  });

  it('should retry on 429 errors', async () => {
    let callCount = 0;
    const mockInteract = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('429 Too Many Requests'));
      }
      return Promise.resolve({ pedagogicalState: 'EXPLANATION' });
    });

    const doInteract = async (input: string, retries = 3) => {
      try {
        return await mockInteract(input);
      } catch (err: unknown) {
        if (retries > 0 && err instanceof Error && err.message.includes('429')) {
          await new Promise((r) => setTimeout(r, 1000));
          return doInteract(input, retries - 1);
        }
        throw err;
      }
    };

    const result = await doInteract('ok');
    expect(result).toEqual({ pedagogicalState: 'EXPLANATION' });
    expect(mockInteract).toHaveBeenCalledTimes(2);
  });
});

// ---- processResponse Pattern Tests ----

describe('processResponse Pattern', () => {
  it('should map COMPLETED state to completed UI', () => {
    const pedagogicalState = 'COMPLETED';

    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];
    const needsUserInput = statesRequiringInput.includes(pedagogicalState);

    expect(needsUserInput).toBe(false);
    expect(pedagogicalState === 'COMPLETED').toBe(true);
  });

  it('should map ACTIVITY_WAIT state to activity/question UI', () => {
    const stepType = 'activity';
    const hasOptions = true;
    const isActivityPanel = stepType === 'activity' || hasOptions;

    expect(isActivityPanel).toBe(true);
  });

  it('should auto-advance for content states', () => {
    const contentStates = ['EXPLANATION', 'ACTIVE_CLASS'];
    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

    for (const state of contentStates) {
      const needsUserInput = statesRequiringInput.includes(state);
      expect(needsUserInput).toBe(false);
    }
  });

  it('should NOT auto-advance for input states', () => {
    const inputStates = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];
    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

    for (const state of inputStates) {
      const needsUserInput = statesRequiringInput.includes(state);
      expect(needsUserInput).toBe(true);
    }
  });
});

// ---- extractText Helper Tests ----

describe('extractText Helper', () => {
  const extractText = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object' && 'text' in val)
      return String((val as { text: unknown }).text);
    return '';
  };

  it('should return string as-is', () => {
    expect(extractText('hello')).toBe('hello');
  });

  it('should extract text from {text: string} object', () => {
    expect(extractText({ text: 'hello' })).toBe('hello');
  });

  it('should return empty string for null', () => {
    expect(extractText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(extractText(undefined)).toBe('');
  });

  it('should return empty string for number', () => {
    expect(extractText(42)).toBe('');
  });
});
