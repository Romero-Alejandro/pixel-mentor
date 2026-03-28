import { type TextareaHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base',
            'focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100',
            'transition-colors duration-200 resize-none',
            'placeholder:text-slate-400',
            error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            className,
          )}
          {...props}
        />
        {error ? <p className="mt-1.5 text-sm text-red-500">{error}</p> : null}
        {helperText && !error ? (
          <p className="mt-1.5 text-sm text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
