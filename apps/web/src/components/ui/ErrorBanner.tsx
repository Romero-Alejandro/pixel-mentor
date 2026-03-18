import { useCallback, useState } from 'react';

import { Button } from './Button';

import { cn } from '@/utils/cn';

export interface ErrorBannerProps {
  /** Error message to display */
  title: string;
  /** Detailed error description */
  message?: string;
  /** Callback for retry action */
  onRetry?: () => void | Promise<void>;
  /** Optional callback for dismiss action */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Number of retry attempts made (for display) */
  retryCount?: number;
  /** Maximum retry attempts allowed */
  maxRetries?: number;
}

export function ErrorBanner({
  title,
  message,
  onRetry,
  onDismiss,
  className,
  retryCount = 0,
  maxRetries = 3,
}: ErrorBannerProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, isRetrying]);

  const canRetry = onRetry && retryCount < maxRetries;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border-2 transition-all',
        'bg-red-50 border-red-200',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Error icon */}
        <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-800">{title}</h3>
          {message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null}
          {retryCount > 0 ? (
            <p className="mt-1 text-xs text-red-500">
              Intento {retryCount} de {maxRetries}
            </p>
          ) : null}
        </div>

        {/* Dismiss button */}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
            aria-label="Cerrar error"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Actions */}
      {canRetry ? (
        <div className="flex justify-end gap-2 ml-13">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            {isRetrying ? (
              <>
                <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin mr-2" />
                Reintentando...
              </>
            ) : (
              'Reintentar'
            )}
          </Button>
        </div>
      ) : null}

      {!canRetry && retryCount >= maxRetries && onDismiss ? (
        <p className="text-xs text-red-500 text-right">Máximo de intentos alcanzado</p>
      ) : null}
    </div>
  );
}

// ─── Compact Error Banner variant ────────────────────────────────────────────

export interface CompactErrorProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function CompactError({ message, onDismiss, className }: CompactErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700',
        className,
      )}
    >
      <svg
        className="shrink-0 w-5 h-5 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded hover:bg-red-100 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
