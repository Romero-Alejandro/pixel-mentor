import type { EarnedBadge, BadgeProgress } from '@pixel-mentor/shared/gamification';

import { BadgeCard } from './BadgeCard';

import { cn } from '@/utils/cn';

export interface BadgeGridProps {
  badges: Array<EarnedBadge | BadgeProgress>;
  columns?: 2 | 3 | 4;
  showProgress?: boolean;
  className?: string;
}

function isEarnedBadge(badge: EarnedBadge | BadgeProgress): badge is EarnedBadge {
  return 'earnedAt' in badge;
}

function getBadgeCode(badge: EarnedBadge | BadgeProgress): string {
  if ('earnedAt' in badge) return badge.code;
  return badge.badge.code;
}

export function BadgeGrid({
  badges,
  columns = 3,
  showProgress = false,
  className,
}: BadgeGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
  };

  // Separate earned and unearned for sorting
  const earned = badges.filter(isEarnedBadge);
  const unearned = badges.filter((b): b is BadgeProgress => !isEarnedBadge(b));

  const displayBadges = showProgress ? [...earned, ...unearned] : earned;

  if (displayBadges.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200',
          className,
        )}
        role="status"
      >
        <span className="text-4xl" aria-hidden="true">
          🎖️
        </span>
        <p className="text-sm font-medium text-slate-500 text-center">
          ¡Aún no tienes insignias!
          <br />
          Completa lecciones para ganar tus primeras insignias.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn('grid gap-3', gridCols[columns], className)}
      role="list"
      aria-label="Insignias"
    >
      {displayBadges.map((badge) => (
        <div key={getBadgeCode(badge)} role="listitem">
          <BadgeCard badge={badge} isEarned={isEarnedBadge(badge)} />
        </div>
      ))}
    </div>
  );
}
