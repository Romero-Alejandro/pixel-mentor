import { useEffect, type HTMLAttributes } from 'react';
import { IconX } from '@tabler/icons-react';

import { cn } from '@/utils/cn';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  className,
  variant = 'default',
  isVisible,
  onClose,
  duration = 5000,
  children,
  ...props
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const variants = {
    default: 'bg-slate-800 text-white border-slate-700',
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-red-600 text-white border-red-500',
    warning: 'bg-amber-500 text-white border-amber-400',
    info: 'bg-sky-600 text-white border-sky-500',
  };

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 animate-slide-down',
        variants[variant],
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Cerrar"
      >
        <IconX className="w-4 h-4" />
      </button>
    </div>
  );
}
