import { createContext, useContext, useState, useCallback } from 'react';

import type { ToastMessage } from '@/types/async-state.types';

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  success: (message: string, options?: Partial<ToastMessage>) => string;
  error: (message: string, options?: Partial<ToastMessage>) => string;
  warning: (message: string, options?: Partial<ToastMessage>) => string;
  info: (message: string, options?: Partial<ToastMessage>) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>): string => {
      const id = generateId();
      const newToast: ToastMessage = {
        id,
        duration: 5000,
        ...toast,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto-remove after duration
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => removeToast(id), newToast.duration);
      }

      return id;
    },
    [removeToast],
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string, options?: Partial<ToastMessage>) =>
      addToast({ type: 'success', message, ...options }),
    [addToast],
  );

  const error = useCallback(
    (message: string, options?: Partial<ToastMessage>) =>
      addToast({ type: 'error', message, duration: 8000, ...options }),
    [addToast],
  );

  const warning = useCallback(
    (message: string, options?: Partial<ToastMessage>) =>
      addToast({ type: 'warning', message, ...options }),
    [addToast],
  );

  const info = useCallback(
    (message: string, options?: Partial<ToastMessage>) =>
      addToast({ type: 'info', message, ...options }),
    [addToast],
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        clearAll,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
