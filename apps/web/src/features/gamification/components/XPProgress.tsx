import { cn } from '@/utils/cn';

const LEVEL_COLORS: Record<number, { bar: string; bg: string; text: string }> = {
  1: { bar: 'bg-green-400', bg: 'bg-green-100', text: 'text-green-700' },
  2: { bar: 'bg-lime-400', bg: 'bg-lime-100', text: 'text-lime-700' },
  3: { bar: 'bg-pink-400', bg: 'bg-pink-100', text: 'text-pink-700' },
  4: { bar: 'bg-blue-400', bg: 'bg-blue-100', text: 'text-blue-700' },
  5: { bar: 'bg-purple-400', bg: 'bg-purple-100', text: 'text-purple-700' },
  6: { bar: 'bg-amber-400', bg: 'bg-amber-100', text: 'text-amber-700' },
};

export interface XPProgressProps {
  currentXP: number;
  xpToNextLevel: number;
  level: number;
  levelTitle: string;
  className?: string;
}

export function XPProgress({
  currentXP,
  xpToNextLevel,
  level,
  levelTitle,
  className,
}: XPProgressProps) {
  const colors = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];
  const progress =
    xpToNextLevel > 0
      ? Math.min(((xpToNextLevel - (currentXP % xpToNextLevel)) / xpToNextLevel) * 100, 100)
      : 100;
  const xpInLevel = xpToNextLevel > 0 ? xpToNextLevel - (currentXP % xpToNextLevel) : 0;
  const percentDone = 100 - progress;

  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={Math.round(percentDone)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso de XP: ${Math.round(percentDone)}% para el siguiente nivel`}
    >
      {/* Level info row */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn('font-bold text-sm', colors.text)}>
          ⭐ Nivel {level}: {levelTitle}
        </span>
        <span className="text-xs font-medium text-slate-500">{currentXP} XP</span>
      </div>

      {/* Progress bar track */}
      <div className={cn('relative h-5 rounded-full overflow-hidden', colors.bg)}>
        {/* Animated progress fill */}
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', colors.bar)}
          style={{ width: `${percentDone}%` }}
        >
          {/* Shine effect */}
          <div
            className="absolute inset-0 animate-shimmer rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>

        {/* XP text inside bar */}
        <div className="absolute inset-0 flex items-center justify-center" data-xp-counter>
          <span className="text-[10px] font-bold text-slate-700 drop-shadow-sm">
            {currentXP} / {currentXP + xpInLevel} XP
          </span>
        </div>
      </div>

      {/* Next level hint */}
      <p className="mt-1 text-[10px] text-slate-400 text-right">
        🎯 {xpInLevel} XP para el siguiente nivel
      </p>
    </div>
  );
}
