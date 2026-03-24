import type { UserGamificationProfile } from '@pixel-mentor/shared/gamification';

import { useStreakAudio } from '@/hooks/useStreakAudio';
import { cn } from '@/utils/cn';

const LEVEL_EMOJIS: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '🌳',
  5: '🌲',
  6: '⛰️',
};

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-green-400',
  2: 'bg-lime-400',
  3: 'bg-pink-400',
  4: 'bg-blue-400',
  5: 'bg-purple-400',
  6: 'bg-amber-400',
};

export interface SessionGamificationBarProps {
  profile: UserGamificationProfile;
  className?: string;
}

export function SessionGamificationBar({ profile, className }: SessionGamificationBarProps) {
  useStreakAudio();
  const { currentLevel, levelTitle, totalXP, xpToNextLevel, currentStreak, badges } = profile;

  const emoji = LEVEL_EMOJIS[currentLevel] ?? '🌱';
  const barColor = LEVEL_COLORS[currentLevel] ?? 'bg-green-400';

  // XP progress within current level
  const xpInLevel = xpToNextLevel > 0 ? totalXP % xpToNextLevel : 0;
  const percentDone = xpToNextLevel > 0 ? Math.round((xpInLevel / xpToNextLevel) * 100) : 100;

  return (
    <div
      className={cn('flex items-center gap-2.5 text-xs h-10', className)}
      role="status"
      aria-label={`Nivel ${currentLevel}: ${levelTitle}, ${totalXP} XP, racha de ${currentStreak} días, ${badges.length} insignias`}
    >
      {/* Level emoji + title */}
      <span className="flex items-center gap-1 shrink-0">
        <span className="text-sm" aria-hidden="true">
          {emoji}
        </span>
        <span className="font-medium text-slate-700 truncate max-w-[100px]">
          Nivel {currentLevel}: {levelTitle}
        </span>
      </span>

      {/* Mini XP progress bar */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className="relative w-[60px] h-1 rounded-full bg-slate-200 overflow-hidden"
          role="progressbar"
          aria-valuenow={percentDone}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`XP: ${percentDone}%`}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${percentDone}%` }}
          />
        </div>
        <span className="font-bold text-slate-800 tabular-nums">{totalXP}XP</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-slate-200" />

      {/* Streak */}
      <span
        className="flex items-center gap-0.5 shrink-0"
        aria-label={`Racha de ${currentStreak} días`}
      >
        <span className="text-xs" aria-hidden="true">
          🔥
        </span>
        <span className="font-bold text-orange-600 tabular-nums">{currentStreak}</span>
      </span>

      {/* Badges */}
      <span
        className="flex items-center gap-0.5 shrink-0"
        aria-label={`${badges.length} insignias`}
      >
        <span className="text-xs" aria-hidden="true">
          🎖️
        </span>
        <span className="font-bold text-amber-700 tabular-nums">{badges.length}</span>
      </span>
    </div>
  );
}
