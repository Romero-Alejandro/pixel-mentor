import { cn } from '@/utils/cn';

const LEVEL_COLORS: Record<number, { bg: string; ring: string; text: string; glow: string }> = {
  1: {
    bg: 'bg-green-400',
    ring: 'ring-green-300',
    text: 'text-green-900',
    glow: 'shadow-green-400/50',
  },
  2: {
    bg: 'bg-lime-400',
    ring: 'ring-lime-300',
    text: 'text-lime-900',
    glow: 'shadow-lime-400/50',
  },
  3: {
    bg: 'bg-pink-400',
    ring: 'ring-pink-300',
    text: 'text-pink-900',
    glow: 'shadow-pink-400/50',
  },
  4: {
    bg: 'bg-blue-400',
    ring: 'ring-blue-300',
    text: 'text-blue-900',
    glow: 'shadow-blue-400/50',
  },
  5: {
    bg: 'bg-purple-400',
    ring: 'ring-purple-300',
    text: 'text-purple-900',
    glow: 'shadow-purple-400/50',
  },
  6: {
    bg: 'bg-amber-400',
    ring: 'ring-amber-300',
    text: 'text-amber-900',
    glow: 'shadow-amber-400/50',
  },
};

const LEVEL_EMOJIS: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '🌳',
  5: '🌲',
  6: '⛰️',
};

export interface LevelBadgeProps {
  level: number;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LevelBadge({ level, title, size = 'md', className }: LevelBadgeProps) {
  const colors = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];
  const emoji = LEVEL_EMOJIS[level] ?? '🌱';

  const sizes = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-24 h-24 text-4xl',
  };

  const titleSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div
      className={cn('flex flex-col items-center gap-1', className)}
      role="status"
      aria-label={`Nivel ${level}: ${title}`}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full ring-4 shadow-lg transition-all duration-300',
          sizes[size],
          colors.bg,
          colors.ring,
          colors.glow,
          'animate-bounce-in',
        )}
      >
        <span className="select-none" aria-hidden="true">
          {emoji}
        </span>
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-white font-bold shadow-md',
            size === 'sm'
              ? 'w-5 h-5 text-[10px]'
              : size === 'md'
                ? 'w-6 h-6 text-xs'
                : 'w-8 h-8 text-sm',
            colors.text,
          )}
        >
          {level}
        </span>
      </div>
      <span className={cn('font-bold text-center leading-tight', titleSizes[size], colors.text)}>
        {title}
      </span>
    </div>
  );
}
