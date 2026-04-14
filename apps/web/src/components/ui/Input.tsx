import { forwardRef, type InputHTMLAttributes, useCallback } from 'react';

import { useAudio } from '../../contexts/AudioContext';
import { MicroAudioEvent } from '../../audio/types/audio-events';

import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const { playMicro } = useAudio();

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        playMicro(MicroAudioEvent.InputFocus);
        props.onFocus?.(e);
      },
      [playMicro, props],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        playMicro(MicroAudioEvent.InputBlur);
        props.onBlur?.(e);
      },
      [playMicro, props],
    );

    let inputValue = props.value;
    if (props.type === 'number') {
      // Ensure value for type="number" input is either a number or an empty string
      // Otherwise, React can complain about controlled vs uncontrolled component
      // or "The specified value '[object Object]' cannot be parsed" error
      if (typeof inputValue === 'string' && inputValue === '') {
        inputValue = '';
      } else if (typeof inputValue === 'string') {
        inputValue = Number(inputValue);
      }
    }

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            'w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base',
            'focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100',
            'transition-colors duration-200',
            'placeholder:text-slate-400',
            error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            className,
          )}
          {...props}
          value={inputValue}
        />
        {error ? <p className="mt-1.5 text-sm text-red-500">{error}</p> : null}
        {helperText && !error ? (
          <p className="mt-1.5 text-sm text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
