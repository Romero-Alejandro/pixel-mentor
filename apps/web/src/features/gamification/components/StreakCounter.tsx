import { cn } from '@/utils/cn';

export interface StreakCounterProps {
  streak: number;
  longestStreak?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StreakCounter({
  streak,
  longestStreak,
  size = 'md',
  className,
}: StreakCounterProps) {
  const sizes = {
    sm: { container: 'gap-1', icon: 'text-lg', count: 'text-sm', label: 'text-[10px]' },
    md: { container: 'gap-2', icon: 'text-2xl', count: 'text-xl', label: 'text-xs' },
    lg: { container: 'gap-3', icon: 'text-4xl', count: 'text-3xl', label: 'text-sm' },
  };

  const style = sizes[size];
  const fireIntensity = streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : streak >= 7 ? '🔥' : '🔥';

  return (
    <div
      className={cn('flex items-center', style.container, className)}
      role="status"
      aria-label={`Racha de ${streak} días`}
    >
      {/* Fire icon with bounce animation */}
      <span className={cn(style.icon, streak > 0 && 'animate-pulse-fire')} aria-hidden="true">
        {fireIntensity}
      </span>

      <div className="flex flex-col">
        {/* Streak count */}
        <span className={cn('font-black text-orange-600 leading-none', style.count)}>{streak}</span>

        {/* Label */}
        <span className={cn('font-medium text-orange-500 leading-tight', style.label)}>
          {streak === 1 ? 'día' : 'días'}
        </span>
      </div>

      {/* Longest streak badge */}
      {longestStreak !== undefined && longestStreak > streak ? (
        <span className="text-[10px] text-slate-400 ml-1" title="Mejor racha">
          🏆 {longestStreak}
        </span>
      ) : null}
    </div>
  );
}
