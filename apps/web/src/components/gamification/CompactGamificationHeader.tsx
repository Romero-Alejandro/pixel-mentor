import { Link } from 'react-router-dom';
import type { UserGamificationProfile } from '@pixel-mentor/shared/gamification';

import { cn } from '@/utils/cn';

const LEVEL_EMOJIS: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '🌳',
  5: '🌲',
  6: '⛰️',
};

export interface CompactGamificationHeaderProps {
  profile: UserGamificationProfile;
  className?: string;
}

export function CompactGamificationHeader({ profile, className }: CompactGamificationHeaderProps) {
  const { currentLevel, currentStreak, badges } = profile;
  const emoji = LEVEL_EMOJIS[currentLevel] ?? '🌱';

  return (
    <Link
      to="/achievements"
      className={cn(
        'flex items-center gap-3 text-sm text-slate-600 hover:text-slate-800 transition-colors',
        className,
      )}
      aria-label={`Nivel ${currentLevel}, racha de ${currentStreak} días, ${badges.length} insignias`}
    >
      <span className="flex items-center gap-0.5">
        <span aria-hidden="true">{emoji}</span>
        <span className="font-semibold">{currentLevel}</span>
      </span>
      <span className="flex items-center gap-0.5">
        <span aria-hidden="true">🔥</span>
        <span className="font-semibold">{currentStreak}</span>
      </span>
      <span className="flex items-center gap-0.5">
        <span aria-hidden="true">🎖️</span>
        <span className="font-semibold">{badges.length}</span>
      </span>
    </Link>
  );
}
