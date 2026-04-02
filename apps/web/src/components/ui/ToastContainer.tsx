import { useToast } from '@/contexts/ToastContext';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import type { ToastMessage } from '@/types/async-state.types';

interface ToastContainerProps {
  className?: string;
  position?: 'top' | 'bottom';
}

const variantIcons: Record<ToastMessage['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  return (
    <Toast isVisible onClose={onClose} variant={toast.type}>
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
          {variantIcons[toast.type]}
        </span>
        <div className="flex-1 min-w-0">
          {toast.title ? <p className="font-medium text-sm">{toast.title}</p> : null}
          <p className={cn('text-sm', toast.title && 'opacity-90')}>{toast.message}</p>
          {toast.action ? (
            <button
              onClick={toast.action.onClick}
              className="mt-1 text-xs font-medium underline hover:text-white/80"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      </div>
    </Toast>
  );
}

export function ToastContainer({ className, position = 'top' }: ToastContainerProps) {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  const positionClasses = {
    top: 'top-4',
    bottom: 'bottom-4',
  };

  return (
    <div
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2',
        positionClasses[position],
        className,
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
