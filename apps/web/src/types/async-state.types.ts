/**
 * Async State Types - Centralized types for async state management
 */

export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: AppError | null;
  isLoading: boolean;
}

export interface AsyncStateOptions<T, E = Error> {
  /** Initial data to show before first fetch */
  initialData?: T;
  /** Callback on successful completion */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: E) => void;
  /** Enable automatic retry on failure */
  retryable?: boolean;
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
}

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  isRetryable: boolean;
  originalError?: Error;
}

export interface RetryConfig {
  enabled: boolean;
  delay: number;
  maxAttempts: number;
  attempt: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface FetchOptions extends RequestInit {
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Timeout in ms */
  timeout?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
}

export type AsyncStateSetter<T> = T | ((prev: T | null) => T);

export type AsyncStateAction<T> =
  | { type: 'pending' }
  | { type: 'success'; payload: T }
  | { type: 'error'; payload: AppError }
  | { type: 'reset' }
  | { type: 'set'; payload: T };
