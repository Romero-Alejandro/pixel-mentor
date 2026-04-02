import { Spinner } from './Spinner';
import { Button } from './Button';

import { cn } from '@/utils/cn';
import type { AppError } from '@/types/async-state.types';

interface AsyncStateViewProps {
  /** The async state status */
  status: 'idle' | 'pending' | 'success' | 'error';
  /** Error object if status is 'error' */
  error?: AppError | null;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Custom idle component */
  idleComponent?: React.ReactNode;
  /** Loading message */
  loadingMessage?: string;
  /** Show retry button on error */
  showRetry?: boolean;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Custom className */
  className?: string;
  /** Children to render on success */
  children?: React.ReactNode;
}

const defaultLoadingMessage = 'Cargando...';

const defaultErrorMessages: Record<string, string> = {
  DEFAULT: 'Algo salió mal. Por favor, intenta de nuevo.',
  NETWORK: 'Error de conexión. Verifica tu internet.',
  TIMEOUT: 'La solicitud tardó demasiado. Intenta de nuevo.',
  UNAUTHORIZED: 'Sesión expirada. Por favor, inicia sesión.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  NOT_FOUND: 'El recurso solicitado no fue encontrado.',
  SERVER: 'Error del servidor. Intenta más tarde.',
};

/**
 * Resolves an error message from an AppError
 */
function resolveErrorMessage(error: AppError): string {
  if (error.message && defaultErrorMessages[error.message]) {
    return defaultErrorMessages[error.message];
  }

  if (error.code && defaultErrorMessages[error.code]) {
    return defaultErrorMessages[error.code];
  }

  if (error.status) {
    if (error.status === 401) return defaultErrorMessages.UNAUTHORIZED;
    if (error.status === 403) return defaultErrorMessages.FORBIDDEN;
    if (error.status === 404) return defaultErrorMessages.NOT_FOUND;
    if (error.status >= 500) return defaultErrorMessages.SERVER;
  }

  // Check message content for common patterns
  const msg = error.message.toLowerCase();
  if (msg.includes('network') || msg.includes('fetch')) {
    return defaultErrorMessages.NETWORK;
  }
  if (msg.includes('timeout')) {
    return defaultErrorMessages.TIMEOUT;
  }

  return error.message || defaultErrorMessages.DEFAULT;
}

export function AsyncStateView({
  status,
  error,
  loadingComponent,
  errorComponent,
  idleComponent,
  loadingMessage = defaultLoadingMessage,
  showRetry = true,
  onRetry,
  className,
  children,
}: AsyncStateViewProps) {
  if (status === 'idle') {
    return (
      <div className={cn('flex items-center justify-center p-4', className)}>
        {idleComponent ?? <p className="text-slate-500">Sin datos</p>}
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        {loadingComponent ?? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-slate-500 text-sm">{loadingMessage}</p>
          </div>
        )}
      </div>
    );
  }

  if (status === 'error') {
    if (errorComponent) {
      return <div className={className}>{errorComponent}</div>;
    }

    const errorMessage = error ? resolveErrorMessage(error) : 'Error desconocido';
    const canRetry = showRetry && error?.isRetryable !== false;

    return (
      <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md">
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">{errorMessage}</p>
          {canRetry && onRetry ? (
            <Button onClick={onRetry} variant="secondary" size="sm" className="mx-auto">
              Reintentar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // Success state - render children
  return <div className={className}>{children}</div>;
}

/**
 * Simplified version for quick inline usage
 */
interface AsyncContentProps {
  isLoading: boolean;
  error?: AppError | null;
  onRetry?: () => void;
  loadingMessage?: string;
  className?: string;
  children: React.ReactNode;
}

export function AsyncContent({
  isLoading,
  error,
  onRetry,
  loadingMessage,
  className,
  children,
}: AsyncContentProps) {
  const status = isLoading ? 'pending' : error ? 'error' : 'success';

  return (
    <AsyncStateView
      status={status}
      error={error}
      onRetry={onRetry}
      loadingMessage={loadingMessage}
      className={className}
    >
      {children}
    </AsyncStateView>
  );
}
