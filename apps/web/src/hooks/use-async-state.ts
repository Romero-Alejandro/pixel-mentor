import { useState, useEffect, useCallback, useRef } from 'react';

import type {
  AsyncState,
  AsyncStateOptions,
  AppError,
  RetryConfig,
} from '@/types/async-state.types';

/**
 * Creates a standardized error object from any error type
 */
function createAppError(error: unknown, isRetryable = true): AppError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const err = error as Record<string, unknown>;
    return {
      message: String(err.message),
      code: err.code ? String(err.code) : undefined,
      status: err.status ? Number(err.status) : undefined,
      isRetryable,
      originalError: error instanceof Error ? error : new Error(String(err.message)),
    };
  }
  return {
    message: error instanceof Error ? error.message : String(error),
    isRetryable,
    originalError: error instanceof Error ? error : new Error(String(error)),
  };
}

function getInitialState<T>(initialData?: T): AsyncState<T> {
  const status = initialData !== undefined ? 'success' : 'idle';
  return {
    status,
    data: initialData ?? null,
    error: null,
    isLoading: false,
  };
}

/**
 * Core hook for managing async state with loading, error, and success states
 */
export function useAsyncState<T>(
  asyncFunction: () => Promise<T>,
  options: AsyncStateOptions<T> = {},
): AsyncState<T> & {
  execute: () => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
} {
  const {
    initialData,
    onSuccess,
    onError,
    retryable = false,
    retryDelay = 1000,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<AsyncState<T>>(() => getInitialState(initialData));

  const retryConfigRef = useRef<RetryConfig>({
    enabled: retryable,
    delay: retryDelay,
    maxAttempts: maxRetries,
    attempt: 0,
  });

  const execute = useCallback(async (): Promise<T | null> => {
    setState((prev) => ({ ...prev, status: 'pending', error: null, isLoading: true }));
    retryConfigRef.current.attempt = 0;

    try {
      const result = await asyncFunction();
      setState({ status: 'success', data: result, error: null, isLoading: false });
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = createAppError(err, retryable);
      setState({ status: 'error', data: null, error, isLoading: false });
      onError?.(err as Error);
      return null;
    }
  }, [asyncFunction, onSuccess, onError, retryable]);

  const retry = useCallback(async (): Promise<T | null> => {
    if (!retryable) {
      return execute();
    }

    retryConfigRef.current.attempt += 1;

    if (retryConfigRef.current.attempt >= retryConfigRef.current.maxAttempts) {
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, retryConfigRef.current.delay));

    return execute();
  }, [execute, retryable]);

  const reset = useCallback(() => {
    setState(getInitialState(initialData));
  }, [initialData]);

  return {
    ...state,
    execute,
    reset,
    retry,
  };
}

/**
 * Simplified hook for fetching data on mount
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  options: AsyncStateOptions<T> = {},
): AsyncState<T> & {
  refetch: () => Promise<T | null>;
} {
  const { onSuccess, onError, retryable = false } = options;
  const mountedRef = useRef(false);

  const [state, setState] = useState<AsyncState<T>>(() => ({
    status: 'pending',
    data: options.initialData ?? null,
    error: null,
    isLoading: true,
  }));

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'pending', isLoading: true }));

    try {
      const result = await fetcher();
      setState({ status: 'success', data: result, error: null, isLoading: false });
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = createAppError(err, retryable);
      setState({ status: 'error', data: null, error, isLoading: false });
      onError?.(err as Error);
      return null;
    }
  }, [fetcher, onSuccess, onError, retryable]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    refetch: fetchData,
  };
}
