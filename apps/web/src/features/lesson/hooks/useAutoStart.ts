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

  // ── Stabilize onStartClass via ref ────────────────────────────────────────
  // onStartClass changes every render because the orchestrator's startClass
  // depends on interactions (new object each render). Without a ref, this
  // causes startWithRetry to be recreated, which triggers the useEffect to
  // re-run, which calls cleanup() → aborts the in-flight start request.
  const onStartClassRef = useRef(onStartClass);
  onStartClassRef.current = onStartClass;

  const [isStarting, setIsStarting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const hasStartedRef = useRef(false);
  // Generation counter: every startWithRetry that proceeds past the guard
  // owns a run id. Stale continuations (aborted StrictMode first attempt,
  // superseded manual retries, previous lessonId) must not touch flags
  // or UI state once a newer run exists.
  const runIdRef = useRef(0);

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

    // Only set isInitializing on the very first start (before any content has loaded)
    if (!hasStartedRef.current) {
      setIsInitializing(true);
    }

    hasStartedRef.current = true;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    setIsStarting(true);
    setError(null);

    const attempt = async (attemptNumber: number) => {
      if (runId !== runIdRef.current || !isMountedRef.current || signal.aborted) return;

      try {
        setIsStarting(true);
        // Use ref to always call the latest onStartClass
        const result = await onStartClassRef.current(lessonId);

        if (runId !== runIdRef.current) return;
        if (!result.ok) throw result.error || new Error('Falla en el inicio');

        if (isMountedRef.current) {
          setRetryCount(0);
          setIsStarting(false);
          setIsInitializing(false);
          setError(null);
        }
      } catch (err) {
        // Stale run (a newer startWithRetry took over): never touch flags/state.
        if (runId !== runIdRef.current) return;
        if (signal.aborted || !isMountedRef.current) {
          // The in-flight attempt was aborted by cleanup (React StrictMode
          // remount in dev aborts the first attempt). The re-run effect
          // restarts the lesson (see the lessonId effect below), so here
          // we only release the flag and let the owning run drive UI state.
          hasStartedRef.current = false;
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

        if (attemptNumber < maxRetries) {
          const delay = getBackoffDelay(attemptNumber);
          setRetryCount(attemptNumber + 1);
          setError(`${errorMessage}. Reintentando en ${Math.round(delay / 1000)}s...`);
          setIsTransitioning(true);

          retryTimeoutRef.current = setTimeout(() => attempt(attemptNumber + 1), delay);
        } else {
          setError(`No se pudo conectar después de ${maxRetries} intentos.`);
          setIsStarting(false);
          setIsInitializing(false);
        }
      }
    };

    attempt(0);
  }, [lessonId, maxRetries, cleanup, baseDelayMs, maxDelayMs]);

  const resetStarted = useCallback(() => {
    hasStartedRef.current = false;
    setIsStarting(false);
    setIsInitializing(false);
    setIsTransitioning(false);
    setError(null);
    startWithRetry();
  }, [startWithRetry]);

  const retry = useCallback(() => {
    hasStartedRef.current = false;
    startWithRetry();
  }, [startWithRetry]);

  // A new lessonId is a new startup: release the started flag so the
  // effect below launches it. This also covers the React StrictMode remount
  // in dev (its cleanup aborts the first attempt; without this reset the
  // re-run effect would see hasStartedRef true and skip, hanging the UI on
  // "Preparando la aventura..." forever). Runs before the starter effect.
  useEffect(() => {
    hasStartedRef.current = false;
  }, [lessonId]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoStart && lessonId && !hasStartedRef.current) {
      startWithRetry();
    }
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
    // startWithRetry is stable now (deps no longer include onStartClass)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, autoStart, startWithRetry, cleanup]);

  return {
    isStarting,
    isInitializing,
    isTransitioning,
    error,
    retryCount,
    retry,
    resetStarted,
    setIsTransitioning,
    setIsInitializing: (val: boolean) => setIsInitializing(val),
  };
}
