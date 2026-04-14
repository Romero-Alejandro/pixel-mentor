import { useEffect, useState, memo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

// Helper interno para evitar objetos en el render
const renderSafe = (value: any) => {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !('$$typeof' in value)
  )
    return '';
  return value;
};

export const Modal = memo(
  ({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) => {
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
      let container = document.getElementById('modal-portal');
      if (!container) {
        container = document.createElement('div');
        container.id = 'modal-portal';
        document.body.appendChild(container);
      }
      setPortalContainer(container);
    }, []);

    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
        const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handleEsc);
        return () => {
          document.body.style.overflow = '';
          window.removeEventListener('keydown', handleEsc);
        };
      }
    }, [isOpen, onClose]);

    if (!isOpen || !portalContainer) return null;

    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />

        <div
          className={cn(
            'relative w-full bg-white rounded-[2.5rem] border-8 border-sky-100 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300',
            sizeClasses[size],
          )}
        >
          {title ? (
            <header className="flex items-center justify-between p-6 border-b-8 border-sky-50 shrink-0">
              <h2 className="text-2xl font-black text-sky-900 tracking-tight">
                {renderSafe(title)}
              </h2>
              <button
                onClick={onClose}
                className="p-3 rounded-2xl bg-rose-50 text-rose-500 border-4 border-rose-100 hover:scale-110 transition-transform"
              >
                <IconX size={24} stroke={4} />
              </button>
            </header>
          ) : null}

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">{children}</div>

          {footer ? (
            <footer className="p-6 bg-sky-50/50 border-t-8 border-sky-50 shrink-0">{footer}</footer>
          ) : null}
        </div>
      </div>,
      portalContainer,
    );
  },
);

Modal.displayName = 'Modal';
