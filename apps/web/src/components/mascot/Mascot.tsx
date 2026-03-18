import { useRive, Layout, Fit, Alignment, useStateMachineInput } from '@rive-app/react-canvas';
import { useCallback, useState, useMemo, memo, useEffect } from 'react';

import { useLessonStore } from '@/stores/lessonStore';
import { cn } from '@/utils/cn';

type AvatarState =
  | 'speaking'
  | 'listening'
  | 'thinking'
  | 'explaining'
  | 'happy'
  | 'waiting'
  | 'idle';

function getAvatarState(
  isSpeaking: boolean,
  isListening: boolean,
  currentState: string,
): AvatarState {
  const isWaitingInteraction = ['ACTIVITY_WAIT', 'AWAITING_START', 'QUESTION'].includes(
    currentState,
  );

  if (isListening) return 'listening';
  if (isSpeaking && !isWaitingInteraction) return 'speaking';

  switch (currentState) {
    case 'RESOLVING_DOUBT':
      return 'thinking';
    case 'EXPLANATION':
    case 'ACTIVE_CLASS':
      return 'explaining';
    case 'COMPLETED':
      return 'happy';
    case 'ACTIVITY_WAIT':
    case 'AWAITING_START':
      return 'waiting';
    default:
      return 'idle';
  }
}

const STATE_THEMES: Record<
  AvatarState,
  { color: string; icon: string; label: string; particles: string[] }
> = {
  speaking: { color: 'bg-cyan-400', icon: '🗣️', label: 'Hablando', particles: ['✨', '💬', '✨'] },
  listening: {
    color: 'bg-amber-400',
    icon: '👂',
    label: 'Escuchando',
    particles: ['🎵', '🎶', '✨'],
  },
  thinking: {
    color: 'bg-purple-400',
    icon: '🤔',
    label: 'Analizando',
    particles: ['❓', '🔮', '✨'],
  },
  explaining: {
    color: 'bg-emerald-400',
    icon: '📚',
    label: 'Explicando',
    particles: ['💡', '✨', '🌟'],
  },
  happy: { color: 'bg-pink-400', icon: '😸', label: '¡Genial!', particles: ['🎉', '⭐', '✨'] },
  waiting: { color: 'bg-orange-400', icon: '⏳', label: 'Tu turno', particles: [] },
  idle: { color: 'bg-indigo-400', icon: '😺', label: 'Listo', particles: ['✨'] },
};

interface MascotProps {
  className?: string;
}

export const Mascot = memo(function Mascot({ className = '' }: MascotProps) {
  const { isSpeaking, isListening, currentState } = useLessonStore();
  const isStart = currentState === 'AWAITING_START';

  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const avatarState = getAvatarState(isSpeaking, isListening, currentState);
  const theme = STATE_THEMES[avatarState];

  const particleStyles = useMemo(() => {
    return theme.particles.map((_, i) => ({
      left: `${25 + Math.random() * 50}%`,
      bottom: `${20 + Math.random() * 10}%`,
      animationDelay: `${i * 0.3}s`,
      animationDuration: `${2.5 + Math.random() * 1.5}s`,
    }));
  }, [theme.particles]);

  const { rive, RiveComponent } = useRive({
    src: '/assets/magic-cat.riv',
    stateMachines: 'BLACK CATW',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
    onLoad: () => {
      setIsLoaded(true);
    },
  });

  const hoverInput = useStateMachineInput(rive, 'BLACK CATW', 'Hover');

  useEffect(() => {
    if (hoverInput) {
      hoverInput.value = avatarState === 'waiting' || isHovered;
    }
  }, [avatarState, isHovered, hoverInput]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-1000 ease-out',
        isStart ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-48 h-48 sm:w-56 sm:h-56',
        className,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-700 z-0',
          isLoaded ? 'opacity-0 scale-125 pointer-events-none' : 'opacity-100 scale-100',
        )}
      >
        <div className="absolute w-3/4 h-3/4 bg-indigo-400/30 rounded-full blur-2xl animate-pulse" />
        <div className="absolute w-1/2 h-1/2 bg-sky-300/40 rounded-full blur-xl animate-ping" />
        <span className="text-4xl animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
          ✨
        </span>
      </div>

      <div
        className={cn(
          'absolute inset-0 rounded-full opacity-30 blur-[50px] transition-all duration-1000',
          theme.color,
          isLoaded ? 'scale-125' : 'scale-50 opacity-0',
          (avatarState === 'speaking' || avatarState === 'listening') &&
            'animate-pulse opacity-50 scale-[1.35]',
          avatarState === 'happy' && 'opacity-60 scale-[1.40]',
        )}
      />

      {isLoaded && theme.particles.length > 0 ? (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
          {theme.particles.map((particle, i) => (
            <span
              key={`${avatarState}-${i}`}
              className={cn(
                'absolute animate-float-up opacity-0',
                i % 2 === 0 ? 'text-xl' : 'text-2xl',
              )}
              style={particleStyles[i]}
            >
              {particle}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'absolute bottom-2 w-2/3 h-6 bg-slate-900/15 blur-md rounded-[100%] shadow-2xl transition-all duration-700',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
        )}
      />

      <div
        className={cn(
          'relative z-10 w-full h-full transform-gpu transition-all duration-1000 ease-out hover:scale-105 active:scale-95 animate-float',
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        )}
      >
        <RiveComponent className="w-full h-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.2)]" />
      </div>

      <div
        className={cn(
          'absolute -bottom-4 right-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl shadow-xl border border-white/60',
          'bg-white/90 backdrop-blur-md transition-all duration-500 transform-gpu z-30',
          isSpeaking || isListening ? 'scale-110 -translate-y-2' : 'scale-100',
          !isLoaded && 'opacity-0 translate-y-4 scale-75',
        )}
      >
        <div className="relative flex h-2.5 w-2.5 items-center justify-center">
          {isSpeaking || isListening ? (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                theme.color,
              )}
            />
          ) : null}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', theme.color)} />
        </div>

        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-700">
          <span className="text-sm drop-shadow-sm">{theme.icon}</span>
          {theme.label}
        </span>
      </div>
    </div>
  );
});
