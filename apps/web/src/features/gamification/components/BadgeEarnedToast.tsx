import { useEffect, useState } from 'react';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { cn } from '@/utils/cn';

export interface BadgeEarnedToastProps {
  badge: EarnedBadge;
  onDismiss: () => void;
  className?: string;
}

const AUTO_DISMISS_MS = 3000;
const SLIDE_IN_MS = 300;
const BOUNCE_MS = 500;
const SLIDE_OUT_MS = 300;

type ToastPhase = 'entering' | 'bouncing' | 'visible' | 'exiting';

export function BadgeEarnedToast({ badge, onDismiss, className }: BadgeEarnedToastProps) {
  const [phase, setPhase] = useState<ToastPhase>('entering');

  // Sequence: slide-in → bounce → visible (auto-dismiss after 3s)
  useEffect(() => {
    const slideInTimer = setTimeout(() => setPhase('bouncing'), SLIDE_IN_MS);
    const bounceTimer = setTimeout(() => setPhase('visible'), SLIDE_IN_MS + BOUNCE_MS);
    const dismissTimer = setTimeout(
      () => setPhase('exiting'),
      SLIDE_IN_MS + BOUNCE_MS + AUTO_DISMISS_MS,
    );

    return () => {
      clearTimeout(slideInTimer);
      clearTimeout(bounceTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  // After exit animation completes, call onDismiss
  useEffect(() => {
    if (phase === 'exiting') {
      const timer = setTimeout(onDismiss, SLIDE_OUT_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, onDismiss]);

  const handleDismiss = () => {
    if (phase !== 'exiting') {
      setPhase('exiting');
    }
  };

  const animationClass =
    phase === 'entering'
      ? 'animate-toast-in'
      : phase === 'bouncing'
        ? 'animate-toast-bounce'
        : phase === 'exiting'
          ? 'animate-toast-out'
          : '';

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer select-none',
        'bg-white border-2 border-amber-300 shadow-[0_4px_24px_rgba(251,191,36,0.35)]',
        'transition-shadow hover:shadow-[0_6px_32px_rgba(251,191,36,0.5)]',
        animationClass,
        className,
      )}
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleDismiss();
      }}
      role="status"
      aria-live="polite"
      aria-label={`¡Ganaste la insignia ${badge.name}! +${badge.xpReward} XP`}
      tabIndex={0}
    >
      {/* Badge icon with golden glow ring */}
      <div
        className="animate-badge-glow flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-amber-50"
        aria-hidden="true"
      >
        <span className="text-3xl">{badge.icon}</span>
      </div>

      {/* Badge info */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-black text-amber-800 truncate">{badge.name}</span>
        {badge.xpReward > 0 ? (
          <span className="text-xs font-bold text-amber-600">+{badge.xpReward} XP</span>
        ) : null}
      </div>
    </div>
  );
}
