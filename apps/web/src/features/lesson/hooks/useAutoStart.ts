import { useState, useRef, useEffect, useCallback } from 'react';

export interface AutoStartConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  autoStart?: boolean;
}

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

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  const getBackoffDelay = (attempt: number): number => {
    return Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  };

  const startWithRetry = useCallback(() => {
    if (!lessonId || hasStartedRef.current || !isMountedRef.current) return;

    cleanup();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    hasStartedRef.current = true;
    setIsStarting(true);
    setError(null);

    const attempt = async (attemptNumber: number) => {
      if (!isMountedRef.current || signal.aborted) return;

      try {
        setIsStarting(true);
        const result = await onStartClass(lessonId);

        if (!result.ok) throw result.error || new Error('Falla en el inicio');

        if (isMountedRef.current) {
          setRetryCount(0);
          setIsStarting(false);
          setError(null);
        }
      } catch (err) {
        if (!isMountedRef.current || signal.aborted) return;

        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

        if (attemptNumber < maxRetries) {
          const delay = getBackoffDelay(attemptNumber);
          setRetryCount(attemptNumber + 1);
          setError(`${errorMessage}. Reintentando en ${Math.round(delay / 1000)}s...`);
          setIsStarting(false);

          retryTimeoutRef.current = setTimeout(() => attempt(attemptNumber + 1), delay);
        } else {
          setError(`No se pudo conectar después de ${maxRetries} intentos.`);
          setIsStarting(false);
        }
      }
    };

    attempt(0);
  }, [lessonId, maxRetries, onStartClass, cleanup, baseDelayMs, maxDelayMs]);

  const resetStarted = useCallback(() => {
    hasStartedRef.current = false;
    setIsStarting(false);
    setError(null);
    // Importante: También iniciar automáticamente después de reset
    startWithRetry();
  }, [startWithRetry]);

  const retry = useCallback(() => {
    hasStartedRef.current = false;
    startWithRetry();
  }, [startWithRetry]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoStart && lessonId && !hasStartedRef.current) {
      startWithRetry();
    }
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [lessonId, autoStart, startWithRetry, cleanup]);

  return { isStarting, error, retryCount, retry, resetStarted };
}
