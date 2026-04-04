import {
  useState,
  useCallback,
  type ReactNode,
  createContext,
  useContext,
  type KeyboardEvent,
} from 'react';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// --- Types ---

export type DialogVariant = 'danger' | 'warning' | 'info' | 'error' | 'success';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Exclude<DialogVariant, 'error' | 'success'>;
}

export interface AlertOptions {
  title: string;
  message: string;
  variant?: DialogVariant;
}

export interface PromptOptions {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
}

type PendingDialog =
  | { type: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { type: 'alert'; options: AlertOptions; resolve: () => void }
  | { type: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

// --- Context ---

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
}

// --- Hooks ---

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const { confirm } = useDialogContext();
  return confirm;
}

export function useAlert(): (options: AlertOptions) => Promise<void> {
  const { alert } = useDialogContext();
  return alert;
}

export function usePrompt(): (options: PromptOptions) => Promise<string | null> {
  const { prompt } = useDialogContext();
  return prompt;
}

// --- ConfirmDialog Component ---

const variantIcons: Record<string, typeof IconAlertTriangle> = {
  danger: IconAlertTriangle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
};

const variantIconColors: Record<string, string> = {
  danger: 'text-rose-500',
  warning: 'text-amber-500',
  info: 'text-sky-500',
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const Icon = variantIcons[variant] ?? IconAlertTriangle;
  const iconColor = variantIconColors[variant] ?? 'text-slate-500';

  const confirmVariant =
    variant === 'danger' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" closeOnBackdrop={false}>
      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 ${iconColor}`}>
          <Icon className="w-12 h-12" />
        </div>
        <p className="text-slate-600 font-medium mb-6">{message}</p>
        <div className="flex gap-3 w-full">
          <Button onClick={onClose} variant="secondary" className="flex-1" disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant={confirmVariant}
            className="flex-1"
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- AlertDialog Component ---

const alertVariantIcons: Record<string, typeof IconAlertTriangle> = {
  error: IconAlertTriangle,
  danger: IconAlertTriangle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
  success: IconInfoCircle,
};

const alertVariantIconColors: Record<string, string> = {
  error: 'text-rose-500',
  danger: 'text-rose-500',
  warning: 'text-amber-500',
  info: 'text-sky-500',
  success: 'text-emerald-500',
};

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: DialogVariant;
}

function AlertDialog({ isOpen, onClose, title, message, variant = 'error' }: AlertDialogProps) {
  const Icon = alertVariantIcons[variant] ?? IconAlertTriangle;
  const iconColor = alertVariantIconColors[variant] ?? 'text-slate-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" closeOnBackdrop={false}>
      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 ${iconColor}`}>
          <Icon className="w-12 h-12" />
        </div>
        <p className="text-slate-600 font-medium mb-6">{message}</p>
        <Button onClick={onClose} variant="primary" className="w-full">
          Entendido
        </Button>
      </div>
    </Modal>
  );
}

// --- PromptDialog Component ---

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  message: string;
  defaultValue: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

function PromptDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder,
  value,
  onChange,
}: PromptDialogProps) {
  const handleSubmit = () => {
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" closeOnBackdrop={false}>
      <div className="flex flex-col">
        <p className="text-slate-600 font-medium mb-4">{message}</p>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full mb-6"
          autoFocus
        />
        <div className="flex gap-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} variant="primary" className="flex-1">
            Aceptar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Provider ---

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [promptValue, setPromptValue] = useState('');

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ type: 'confirm', options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      setPending({ type: 'alert', options, resolve });
    });
  }, []);

  const promptFn = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? '');
      setPending({ type: 'prompt', options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (pending?.type === 'confirm') {
      setIsConfirming(true);
      const { resolve } = pending;
      setPending(null);
      resolve(true);
      setIsConfirming(false);
    }
  }, [pending]);

  const handleCancel = useCallback(() => {
    if (!pending) return;
    const { resolve } = pending;
    if (pending.type === 'prompt') {
      (resolve as (value: string | null) => void)(null);
    } else if (pending.type === 'confirm') {
      (resolve as (value: boolean) => void)(false);
    } else {
      (resolve as () => void)();
    }
    setPending(null);
  }, [pending]);

  const handlePromptSubmit = useCallback(() => {
    if (pending?.type === 'prompt') {
      const { resolve } = pending;
      const value = promptValue;
      setPending(null);
      (resolve as (value: string | null) => void)(value);
    }
  }, [pending, promptValue]);

  const contextValue: DialogContextValue = { confirm, alert, prompt: promptFn };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {/* Confirm Dialog */}
      {pending?.type === 'confirm' ? (
        <ConfirmDialog
          isOpen
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title={pending.options.title}
          message={pending.options.message}
          confirmText={pending.options.confirmText ?? 'Confirmar'}
          cancelText={pending.options.cancelText ?? 'Cancelar'}
          variant={pending.options.variant ?? 'danger'}
          isLoading={isConfirming}
        />
      ) : null}
      {/* Alert Dialog */}
      {pending?.type === 'alert' ? (
        <AlertDialog
          isOpen
          onClose={handleCancel}
          title={pending.options.title}
          message={pending.options.message}
          variant={pending.options.variant ?? 'error'}
        />
      ) : null}
      {/* Prompt Dialog */}
      {pending?.type === 'prompt' ? (
        <PromptDialog
          isOpen
          onClose={handleCancel}
          onSubmit={handlePromptSubmit}
          title={pending.options.title}
          message={pending.options.message}
          defaultValue={pending.options.defaultValue ?? ''}
          placeholder={pending.options.placeholder}
          value={promptValue}
          onChange={setPromptValue}
        />
      ) : null}
    </DialogContext.Provider>
  );
}
