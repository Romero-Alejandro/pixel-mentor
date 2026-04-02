import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseRetryOptions {
  /** Initial retry enabled state */
  enabled?: boolean;
  /** Delay between retries in ms */
  delay?: number;
  /** Maximum retry attempts */
  maxAttempts?: number;
  /** Callback when retry succeeds */
  onSuccess?: () => void;
  /** Callback when retry fails */
  onFailed?: (attempt: number, error: Error) => void;
  /** Callback when all retries exhausted */
  onExhausted?: (totalAttempts: number) => void;
}

export interface UseRetryReturn {
  isRetrying: boolean;
  attempt: number;
  canRetry: boolean;
  retry: (retryFn: () => Promise<unknown>) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/**
 * Hook for managing retry logic with configurable behavior
 */
export function useRetry(options: UseRetryOptions = {}): UseRetryReturn {
  const {
    enabled = false,
    delay = 1000,
    maxAttempts = 3,
    onSuccess,
    onFailed,
    onExhausted,
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [canRetry, setCanRetry] = useState(enabled);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setAttempt(0);
    setCanRetry(enabled);
    setIsRetrying(false);
  }, [enabled]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsRetrying(false);
  }, []);

  const retry = useCallback(
    async (retryFn: () => Promise<unknown>) => {
      if (!canRetry || isRetrying) return;

      setIsRetrying(true);
      setAttempt((prev) => prev + 1);

      try {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await retryFn();
        setIsRetrying(false);
        setCanRetry(false);
        onSuccess?.();
      } catch (error) {
        setIsRetrying(false);
        onFailed?.(attempt + 1, error instanceof Error ? error : new Error(String(error)));

        if (attempt + 1 >= maxAttempts) {
          setCanRetry(false);
          onExhausted?.(attempt + 1);
        } else {
          setCanRetry(true);
        }
      }
    },
    [canRetry, isRetrying, attempt, delay, maxAttempts, onSuccess, onFailed, onExhausted],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isRetrying,
    attempt,
    canRetry,
    retry,
    cancel,
    reset,
  };
}
