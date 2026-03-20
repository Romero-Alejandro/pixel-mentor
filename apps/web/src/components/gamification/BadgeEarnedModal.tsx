import { useCallback, useEffect } from 'react';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

export interface BadgeEarnedModalProps {
  badge: EarnedBadge;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function BadgeEarnedModal({ badge, isOpen, onClose, className }: BadgeEarnedModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`¡Ganaste la insignia ${badge.name}!`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sparkle particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {['✨', '⭐', '🌟', '💫', '✨', '⭐'].map((sparkle, i) => (
          <span
            key={i}
            className="absolute text-xl animate-sparkle"
            style={{
              left: `${15 + i * 14}%`,
              top: `${20 + Math.sin(i) * 30}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + Math.random()}s`,
            }}
          >
            {sparkle}
          </span>
        ))}
      </div>

      {/* Modal content */}
      <div
        className={cn(
          'relative z-10 flex flex-col items-center gap-4 p-8 mx-4 rounded-3xl',
          'bg-gradient-to-br from-white to-amber-50',
          'border-4 border-amber-300 shadow-2xl',
          'animate-scale-in',
          className,
        )}
      >
        {/* Header */}
        <span className="text-lg font-bold text-amber-600">¡Nueva insignia! 🎖️</span>

        {/* Badge icon with glow */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-amber-300/40 blur-xl animate-pulse" />
          <span className="relative text-6xl animate-bounce-once" aria-hidden="true">
            {badge.icon}
          </span>
        </div>

        {/* Badge name */}
        <h2 className="text-xl font-black text-amber-800 text-center">{badge.name}</h2>

        {/* Badge description */}
        <p className="text-sm text-amber-700 text-center max-w-xs">{badge.description}</p>

        {/* XP reward */}
        {badge.xpReward > 0 ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-200">
            <span className="text-lg" aria-hidden="true">
              ⭐
            </span>
            <span className="font-bold text-amber-800">+{badge.xpReward} XP</span>
          </div>
        ) : null}

        {/* Close button */}
        <Button
          variant="primary"
          size="lg"
          onClick={onClose}
          className="mt-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-white font-bold"
        >
          ¡Increíble! 🎉
        </Button>
      </div>
    </div>
  );
}
