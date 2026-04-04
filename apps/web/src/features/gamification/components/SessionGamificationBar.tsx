import type { UserGamificationProfile } from '@pixel-mentor/shared/gamification';
import { IconFlame, IconMedal } from '@tabler/icons-react';

import { useStreakAudio } from '@/features/gamification/hooks/useStreakAudio';
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
  1: 'from-green-400 to-emerald-500',
  2: 'from-lime-400 to-green-500',
  3: 'from-pink-400 to-rose-500',
  4: 'from-blue-400 to-sky-500',
  5: 'from-purple-400 to-violet-500',
  6: 'from-amber-400 to-orange-500',
};

export interface SessionGamificationBarProps {
  profile: UserGamificationProfile;
  className?: string;
}

export function SessionGamificationBar({ profile, className }: SessionGamificationBarProps) {
  useStreakAudio();
  const { currentLevel, levelTitle, totalXP, xpToNextLevel, currentStreak, badges } = profile;

  const emoji = LEVEL_EMOJIS[currentLevel] ?? '🌱';
  const barGradient = LEVEL_COLORS[currentLevel] ?? 'from-green-400 to-emerald-500';

  const xpInLevel = xpToNextLevel > 0 ? totalXP % xpToNextLevel : 0;
  const percentDone = xpToNextLevel > 0 ? Math.round((xpInLevel / xpToNextLevel) * 100) : 100;

  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-slate-50 border-4 border-slate-200 shadow-[0_4px_0_0_#e2e8f0] px-4 py-1.5 rounded-2xl',
        className,
      )}
      role="status"
    >
      <span className="flex items-center gap-1.5 shrink-0 bg-white px-2 py-1 rounded-xl border-2 border-slate-100 shadow-sm">
        <span className="text-lg" aria-hidden="true">
          {emoji}
        </span>
        <span className="font-black text-slate-700 text-xs uppercase tracking-wider hidden sm:block">
          {levelTitle}
        </span>
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="relative w-24 h-3 rounded-full bg-slate-200 border-2 border-slate-300 overflow-hidden"
          role="progressbar"
          aria-valuenow={percentDone}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 bg-gradient-to-r',
              barGradient,
            )}
            style={{ width: `${percentDone}%` }}
          />
        </div>
        <span className="font-black text-sky-700 text-xs tabular-nums bg-sky-100 px-2 py-0.5 rounded-lg border-2 border-sky-200">
          {totalXP} XP
        </span>
      </div>

      <div className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block" />

      <div className="flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded-xl border-2 border-orange-200 font-black text-xs">
          <IconFlame className="w-4 h-4 fill-orange-500 text-orange-500" />
          {currentStreak}
        </span>
        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-xl border-2 border-amber-200 font-black text-xs">
          <IconMedal className="w-4 h-4 fill-amber-500 text-amber-500" />
          {badges.length}
        </span>
      </div>
    </div>
  );
}
