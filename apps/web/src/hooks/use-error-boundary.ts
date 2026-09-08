import { useCallback } from 'react';

import { useToast } from '@/contexts/ToastContext';

interface UseErrorBoundaryReturn {
  /** Show a non-fatal error as a toast notification */
  showError: (error: Error) => void;
  /** Show a non-fatal error with a custom message */
  showErrorWithMessage: (error: Error, message: string) => void;
}

/**
 * Hook that provides error display functions using ToastContext.
 * Use for non-fatal errors that shouldn't unmount the component tree.
 */
export function useErrorBoundary(): UseErrorBoundaryReturn {
  const { error: showToast } = useToast();

  const showError = useCallback(
    (err: Error) => {
      // Log to console for debugging
      console.error('[useErrorBoundary] Non-fatal error:', err.message);
      showToast(err.message);
    },
    [showToast],
  );

  const showErrorWithMessage = useCallback(
    (err: Error, message: string) => {
      console.error('[useErrorBoundary] Non-fatal error:', message, err);
      showToast(message);
    },
    [showToast],
  );

  return { showError, showErrorWithMessage };
}
