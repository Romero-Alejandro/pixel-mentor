import type { EarnedBadge, BadgeProgress } from '@pixel-mentor/shared/gamification';

import { cn } from '@/utils/cn';

export interface BadgeCardProps {
  badge: EarnedBadge | BadgeProgress;
  isEarned?: boolean;
  className?: string;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateString;
  }
}

function getBadgeInfo(badge: EarnedBadge | BadgeProgress) {
  if ('earnedAt' in badge) {
    return {
      name: badge.name,
      icon: badge.icon,
      description: badge.description,
      xpReward: badge.xpReward,
    };
  }
  return {
    name: badge.badge.name,
    icon: badge.badge.icon,
    description: badge.badge.description,
    xpReward: badge.badge.xpReward,
  };
}

export function BadgeCard({ badge, isEarned: isEarnedProp, className }: BadgeCardProps) {
  const isEarned = isEarnedProp ?? 'earnedAt' in badge;
  const progress = 'percentage' in badge ? badge.percentage : null;
  const earnedAt = 'earnedAt' in badge ? badge.earnedAt : null;
  const info = getBadgeInfo(badge);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300',
        isEarned
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-md hover:shadow-lg hover:scale-105'
          : 'bg-slate-50 border-slate-200 opacity-60',
        className,
      )}
      role="article"
      aria-label={`Insignia: ${info.name}${isEarned ? ' — Ganada' : ' — Bloqueada'}`}
    >
      {/* Lock overlay for unearned */}
      {!isEarned ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-200/40 z-10">
          <span className="text-2xl" aria-hidden="true">
            🔒
          </span>
        </div>
      ) : null}

      {/* Badge icon */}
      <span
        className={cn(
          'text-4xl transition-transform duration-300',
          isEarned && 'animate-wiggle-once',
        )}
        aria-hidden="true"
      >
        {info.icon}
      </span>

      {/* Badge name */}
      <span
        className={cn(
          'text-xs font-bold text-center leading-tight',
          isEarned ? 'text-amber-800' : 'text-slate-500',
        )}
      >
        {info.name}
      </span>

      {/* Badge description */}
      <span
        className={cn(
          'text-[10px] text-center leading-snug',
          isEarned ? 'text-amber-600' : 'text-slate-400',
        )}
      >
        {info.description}
      </span>

      {/* XP reward */}
      {info.xpReward > 0 ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
            isEarned ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-500',
          )}
        >
          ⭐ +{info.xpReward} XP
        </span>
      ) : null}

      {/* Earned date or progress */}
      {earnedAt && isEarned ? (
        <span className="text-[10px] text-slate-400">📅 {formatDate(earnedAt)}</span>
      ) : null}

      {progress !== null && !isEarned ? (
        <div className="w-full">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Progreso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
