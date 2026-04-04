import { useCallback, useEffect } from 'react';
import type { LevelUpInfo } from '@pixel-mentor/shared/gamification';

import { LevelBadge } from './LevelBadge';

import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

const CONFETTI_EMOJIS = ['🎉', '🎊', '⭐', '✨', '🌟', '💫', '🎈', '🏆'];

export interface LevelUpModalProps {
  levelUp: LevelUpInfo;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function LevelUpModal({ levelUp, isOpen, onClose, className }: LevelUpModalProps) {
  const { newLevel, newLevelTitle, previousLevel } = levelUp;
  const { playSprite } = useAudio();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        playSprite(SpriteAudioEvent.LevelUp);
      }, 300);
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(timeout);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown, playSprite]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`¡Subiste al nivel ${newLevel}!`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {CONFETTI_EMOJIS.map((emoji, i) => (
          <span
            key={i}
            className="absolute text-2xl animate-confetti-fall"
            style={{
              left: `${10 + i * 12}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            {emoji}
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
        {/* Crown / Trophy */}
        <span className="text-5xl animate-bounce" aria-hidden="true">
          🏆
        </span>

        {/* Title */}
        <h2 className="text-2xl font-black text-amber-700 text-center">¡Subiste de nivel!</h2>

        {/* Level transition */}
        <div className="flex items-center gap-4">
          <div className="text-center opacity-60">
            <span className="text-sm font-bold text-slate-500">Nivel {previousLevel}</span>
          </div>

          <span className="text-2xl animate-arrow-bounce" aria-hidden="true">
            ➡️
          </span>

          <LevelBadge level={newLevel} title={newLevelTitle} size="lg" />
        </div>

        {/* Encouragement message */}
        <p className="text-center text-slate-600 font-medium">
          ¡Excelente trabajo! Ahora eres un <strong>{newLevelTitle}</strong>.
          <br />
          ¡Sigue así! 🚀
        </p>

        {/* Close button */}
        <Button
          variant="primary"
          size="lg"
          onClick={onClose}
          className="mt-2 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-bold"
        >
          ¡Genial! 🎉
        </Button>
      </div>
    </div>
  );
}
