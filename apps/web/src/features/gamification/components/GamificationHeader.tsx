import type { UserGamificationProfile } from '@pixel-mentor/shared/gamification';

import { LevelBadge } from './LevelBadge';
import { XPProgress } from './XPProgress';
import { StreakCounter } from './StreakCounter';

import { cn } from '@/utils/cn';

export interface GamificationHeaderProps {
  profile: UserGamificationProfile;
  className?: string;
}

export function GamificationHeader({ profile, className }: GamificationHeaderProps) {
  const { currentLevel, levelTitle, currentStreak, longestStreak, totalXP, xpToNextLevel, badges } =
    profile;

  return (
    <header
      className={cn(
        'flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-100 shadow-sm',
        className,
      )}
      aria-label="Progreso de gamificación"
    >
      {/* Level Badge */}
      <LevelBadge level={currentLevel} title={levelTitle} size="md" />

      {/* XP Progress */}
      <div className="flex-1 w-full min-w-0">
        <XPProgress
          currentXP={totalXP}
          xpToNextLevel={xpToNextLevel}
          level={currentLevel}
          levelTitle={levelTitle}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Streak */}
        <StreakCounter streak={currentStreak} longestStreak={longestStreak} size="sm" />

        {/* Badge count */}
        <div
          className="flex items-center gap-1.5"
          role="status"
          aria-label={`${badges.length} insignias ganadas`}
        >
          <span className="text-lg" aria-hidden="true">
            🎖️
          </span>
          <span className="text-sm font-bold text-amber-700">{badges.length}</span>
        </div>
      </div>
    </header>
  );
}
