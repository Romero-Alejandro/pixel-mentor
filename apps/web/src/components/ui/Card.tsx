import { type HTMLAttributes, type Ref } from 'react';

import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'mission' | 'locked' | 'completed';
  ref?: Ref<HTMLDivElement>;
}

export function Card({ ref, className, variant = 'mission', children, ...props }: CardProps) {
  const variants = {
    mission: 'bg-white border-4 border-sky-200 shadow-gummy shadow-sky-200',
    locked: 'bg-slate-100 border-4 border-slate-200 opacity-80',
    completed: 'bg-emerald-50 border-4 border-emerald-300 shadow-gummy shadow-emerald-200',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[2rem] p-6 transition-transform duration-300 hover:-translate-y-1',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
