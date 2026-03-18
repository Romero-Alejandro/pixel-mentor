import { useEffect, useRef, useCallback, useState } from 'react';

export interface AutoStartConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  autoStart?: boolean;
}

/**
 * Hook to auto-start a lesson with retry logic and proper cancellation
 */
export function useAutoStart(
  lessonId: string | null,
  onStartClass: (lessonId: string) => Promise<{ ok: boolean; error?: Error }>,
  config: AutoStartConfig = {},
) {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 5000, autoStart = true } = config;

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const hasStartedRef = useRef(false);

  // Calculate exponential backoff delay
  const getBackoffDelay = useCallback(
    (attempt: number): number => {
      const delay = baseDelayMs * Math.pow(2, attempt);
      return Math.min(delay, maxDelayMs);
    },
    [baseDelayMs, maxDelayMs],
  );

  // Cleanup function to cancel any pending operations
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Start the lesson with retry logic
  const startWithRetry = useCallback(async () => {
    // Don't start if already started, no lessonId, or already starting
    if (!lessonId || hasStartedRef.current || !isMountedRef.current) {
      return;
    }

    // Cancel any previous attempts
    cleanup();

    // Create new abort controller for this attempt
    abortControllerRef.current = new AbortController();
    hasStartedRef.current = true;

    setIsStarting(true);
    setError(null);

    const attempt = async (attemptNumber: number): Promise<void> => {
      if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
        return;
      }

      try {
        const result = await onStartClass(lessonId);

        // Check if result indicates an error (Result pattern)
        if (typeof result === 'object' && result !== null && 'ok' in result && !result.ok) {
          throw (result as any).error instanceof Error
            ? (result as any).error
            : new Error('Unknown error');
        }

        // Success - reset retry state
        if (isMountedRef.current) {
          setRetryCount(0);
          setIsStarting(false);
        }
      } catch (err) {
        // Check if aborted or unmounted
        if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
          return;
        }

        // Check if we should retry
        if (attemptNumber < maxRetries) {
          const delay = getBackoffDelay(attemptNumber);

          if (isMountedRef.current) {
            setRetryCount((c) => c + 1);
            setError(
              `Error al iniciar: ${err instanceof Error ? err.message : 'Unknown error'}. Reintentando...`,
            );
          }

          // Schedule retry
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
              attempt(attemptNumber + 1);
            }
          }, delay);
        } else {
          // Max retries reached
          if (isMountedRef.current) {
            setError(
              `No se pudo iniciar la clase después de ${maxRetries} intentos. Por favor, intenta de nuevo.`,
            );
            setIsStarting(false);
          }
        }
      }
    };

    // Start first attempt
    attempt(0);
  }, [lessonId, onStartClass, maxRetries, getBackoffDelay, cleanup, setIsStarting, setError]);

  // Reset state for a new lesson
  const reset = useCallback(() => {
    cleanup();
    hasStartedRef.current = false;
    setIsStarting(false);
    setError(null);
    setRetryCount(0);
  }, [cleanup]);

  // Handle manual retry
  const retry = useCallback(() => {
    hasStartedRef.current = false;
    setRetryCount(0);
    startWithRetry();
  }, [startWithRetry]);

  // Effect to auto-start when lessonId is provided
  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart && lessonId && !hasStartedRef.current) {
      startWithRetry();
    }

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [lessonId, autoStart, startWithRetry, cleanup]);

  // Cleanup on unmount (extra safety)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    isStarting,
    error,
    retryCount,
    start: startWithRetry,
    retry,
    reset,
    cancel: cleanup,
  };
}
