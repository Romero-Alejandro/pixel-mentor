import { forwardRef, memo, type ButtonHTMLAttributes } from 'react';

import { useAudio } from '../../contexts/AudioContext';
import { MicroAudioEvent } from '../../audio/types/audio-events';

import { Spinner } from './Spinner';

import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  audioEvent?: MicroAudioEvent;
}

const BASE_STYLES =
  'relative inline-flex items-center justify-center font-bold outline-none transition-all duration-150 rounded-2xl active:translate-y-1 active:shadow-gummy-active disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';

const VARIANTS = {
  primary:
    'bg-sky-400 text-white shadow-gummy shadow-sky-fun-dark border-2 border-sky-fun-dark hover:bg-sky-300 hover:shadow-gummy-hover hover:-translate-y-0.5',
  secondary:
    'bg-amber-400 text-amber-900 shadow-gummy shadow-amber-fun-dark border-2 border-amber-fun-dark hover:bg-amber-300 hover:shadow-gummy-hover hover:-translate-y-0.5',
  success:
    'bg-emerald-400 text-white shadow-gummy shadow-emerald-fun-dark border-2 border-emerald-fun-dark hover:bg-emerald-300 hover:shadow-gummy-hover hover:-translate-y-0.5',
  danger:
    'bg-rose-400 text-white shadow-gummy shadow-rose-fun-dark border-2 border-rose-fun-dark hover:bg-rose-300 hover:shadow-gummy-hover hover:-translate-y-0.5',
};

const SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-xl',
};

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        className,
        variant = 'primary',
        size = 'md',
        isLoading,
        disabled,
        children,
        audioEvent = MicroAudioEvent.Click,
        onClick: userOnClick,
        ...restProps
      },
      ref,
    ) => {
      const { playMicro } = useAudio();

      const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || isLoading) return;

        try {
          playMicro(audioEvent);
        } catch {
          // Audio error no debe bloquear el flujo
        }

        userOnClick?.(e);
      };

      return (
        <button
          ref={ref}
          className={cn(BASE_STYLES, VARIANTS[variant], SIZES[size], className)}
          disabled={disabled || isLoading}
          onClick={handleClick}
          aria-busy={isLoading}
          {...restProps}
        >
          {isLoading ? (
            <div className="flex items-center" aria-live="polite">
              <Spinner size="sm" className="mr-2" />
              <span>Procesando...</span>
            </div>
          ) : (
            children
          )}
        </button>
      );
    },
  ),
);

Button.displayName = 'Button';
