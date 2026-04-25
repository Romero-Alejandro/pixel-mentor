import { useRive, Layout, Fit, Alignment, useStateMachineInput } from '@rive-app/react-canvas';
import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  IconMessageCircle2Filled,
  IconEar,
  IconBulbFilled,
  IconBookFilled,
  IconMoodHappyFilled,
  IconHourglassHigh,
  IconPawFilled,
  IconSparkles,
} from '@tabler/icons-react';

import { useLessonStore } from '@/features/lesson/stores/lesson.store';
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

const STATE_THEMES: Record<AvatarState, { color: string; icon: React.ElementType; label: string }> =
  {
    speaking: { color: 'bg-cyan-400', icon: IconMessageCircle2Filled, label: 'Hablando' },
    listening: { color: 'bg-amber-400', icon: IconEar, label: 'Escuchando' },
    thinking: { color: 'bg-purple-400', icon: IconBulbFilled, label: 'Analizando' },
    explaining: { color: 'bg-emerald-400', icon: IconBookFilled, label: 'Explicando' },
    happy: { color: 'bg-pink-400', icon: IconMoodHappyFilled, label: '¡Genial!' },
    waiting: { color: 'bg-orange-400', icon: IconHourglassHigh, label: 'Tu turno' },
    idle: { color: 'bg-indigo-400', icon: IconPawFilled, label: 'Listo' },
  };

interface MascotProps {
  className?: string;
}

export function Mascot({ className = '' }: MascotProps) {
  const { isSpeaking, isListening, currentState } = useLessonStore(
    useShallow((state) => ({
      isSpeaking: state.isSpeaking,
      isListening: state.isListening,
      currentState: state.currentState,
    })),
  );

  const isStart = currentState === 'AWAITING_START';
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const avatarState = getAvatarState(isSpeaking, isListening, currentState);
  const theme = STATE_THEMES[avatarState];
  const StateIcon = theme.icon;

  const { rive, RiveComponent } = useRive({
    src: '/assets/magic-cat.riv',
    stateMachines: 'BLACK CATW',
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => setIsLoaded(true),
  });

  const hoverInput = useStateMachineInput(rive, 'BLACK CATW', 'Hover');

  useEffect(() => {
    if (hoverInput) {
      hoverInput.value = avatarState === 'waiting' || isHovered;
    }
  }, [avatarState, isHovered, hoverInput]);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center transition-all duration-1000 ease-out',
        isStart ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-48 h-48 sm:w-56 sm:h-56',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-700 z-0',
          isLoaded ? 'opacity-0 scale-125 pointer-events-none' : 'opacity-100 scale-100',
        )}
      >
        <div className="absolute w-3/4 h-3/4 bg-indigo-400/30 rounded-full blur-2xl animate-pulse" />
        <IconSparkles className="w-16 h-16 text-sky-400 animate-bounce drop-shadow-md" />
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

      <div
        className={cn(
          'absolute bottom-2 w-2/3 h-8 bg-slate-900/20 blur-xl rounded-[100%] transition-all duration-700',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
        )}
      />

      <div
        className={cn(
          'relative z-10 w-full h-full transform-gpu transition-all duration-1000 ease-out hover:scale-105 active:scale-95 animate-float',
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        )}
      >
        <RiveComponent className="w-full h-full drop-shadow-2xl" />
      </div>

      <div
        className={cn(
          'absolute -bottom-4 right-0 flex items-center gap-2 px-4 py-2 rounded-2xl border-4 border-white bg-white shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-all duration-500 z-30',
          isSpeaking || isListening ? 'scale-110 -translate-y-2' : 'scale-100',
          !isLoaded && 'opacity-0 translate-y-4 scale-75',
        )}
      >
        <div className="relative flex h-3 w-3 items-center justify-center">
          {isSpeaking || isListening ? (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                theme.color,
              )}
            />
          ) : null}
          <span className={cn('relative inline-flex h-3 w-3 rounded-full', theme.color)} />
        </div>
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-700">
          <StateIcon className="w-5 h-5 text-slate-600" />
          {theme.label}
        </span>
      </div>
    </div>
  );
}
