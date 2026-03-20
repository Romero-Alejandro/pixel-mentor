import { cn } from '@/utils/cn';

export interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  className?: string;
}

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function StreakWidget({ currentStreak, longestStreak, className }: StreakWidgetProps) {
  return (
    <div
      className={cn(
        'max-w-[300px] rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm',
        className,
      )}
      role="status"
      aria-label={`Racha actual de ${currentStreak} días`}
    >
      {/* Header */}
      <h3 className="text-sm font-semibold text-slate-600 mb-3">Tu Racha</h3>

      {/* Current streak */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl" aria-hidden="true">
          🔥
        </span>
        <span className="text-2xl font-black text-orange-500">{currentStreak}</span>
        <span className="text-sm font-medium text-slate-500">
          {currentStreak === 1 ? 'día seguido!' : 'días seguidos!'}
        </span>
      </div>

      {/* Day indicators */}
      <div className="flex items-center justify-between mb-4">
        {DAYS.map((day, index) => {
          const isActive = index < currentStreak;
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-slate-400">{day}</span>
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors',
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'border-2 border-orange-200 text-orange-200',
                )}
                aria-label={isActive ? `${day}: completado` : `${day}: pendiente`}
              >
                {isActive ? '✓' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Longest streak */}
      <p className="text-xs text-slate-400">
        Racha más larga:{' '}
        <span className="font-semibold text-slate-500">
          {longestStreak} {longestStreak === 1 ? 'día' : 'días'}
        </span>
      </p>
    </div>
  );
}
