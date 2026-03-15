import { useRive, Layout, Fit, Alignment, useStateMachineInput } from '@rive-app/react-canvas';
import { useEffect } from 'react';

import { useLessonStore } from '@/stores/lessonStore';

// Map pedagogical states to avatar states
function getAvatarState(isSpeaking: boolean, isListening: boolean, currentState: string): string {
  if (isSpeaking) return 'speaking';
  if (isListening) return 'listening';

  switch (currentState) {
    case 'RESOLVING_DOUBT':
      return 'thinking';
    case 'EXPLANATION':
    case 'ACTIVE_CLASS':
      return 'explaining';
    case 'COMPLETED':
      return 'happy';
    default:
      return 'idle';
  }
}

export function Mascot() {
  const { isSpeaking, isListening, currentState } = useLessonStore();

  const avatarState = getAvatarState(isSpeaking, isListening, currentState);

  const { rive, RiveComponent } = useRive({
    src: '/assets/magic-cat.riv',
    stateMachines: 'BLACK CATW',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.TopCenter,
    }),
  });

  // Get hover input from state machine
  const hoverInput = useStateMachineInput(rive, 'BLACK CATW', 'Hover');

  // Handle hover interaction
  useEffect(() => {
    if (hoverInput) {
      // We can use hoverInput.value to track mouse hover
      console.log('[Mascot] Avatar state:', avatarState, 'Hover:', hoverInput.value);
    }
  }, [hoverInput, avatarState]);

  // Log state changes for debugging
  useEffect(() => {
    console.log('[Mascot] State changed:', {
      avatarState,
      isSpeaking,
      isListening,
      currentState,
    });
  }, [avatarState, isSpeaking, isListening, currentState]);

  return (
    <div className="w-48 h-48 mx-auto flex items-center justify-center relative overflow-hidden">
      {/* Subtle glow effect */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          isSpeaking
            ? 'bg-cyan-400/20 blur-3xl scale-110'
            : isListening
              ? 'bg-yellow-400/20 blur-3xl'
              : 'bg-transparent'
        }`}
      />

      {/* Rive Avatar */}
      <div className="relative z-10 w-full h-full cursor-pointer">
        <RiveComponent
          className={`w-full h-full transition-transform duration-300 ${
            isSpeaking ? 'animate-pulse' : ''
          }`}
        />
      </div>

      {/* State indicator */}
      <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-2 py-1 shadow-md text-xs font-medium text-slate-600 flex items-center gap-1">
        <span
          className={`w-2 h-2 rounded-full ${
            isSpeaking
              ? 'bg-green-400 animate-pulse'
              : isListening
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-slate-400'
          }`}
        />
        <span className="capitalize">
          {avatarState === 'idle' ? '😺' : null}
          {avatarState === 'listening' ? '👂' : null}
          {avatarState === 'thinking' ? '🤔' : null}
          {avatarState === 'speaking' ? '🗣️' : null}
          {avatarState === 'explaining' ? '📚' : null}
          {avatarState === 'happy' ? '😸' : null}
        </span>
      </div>
    </div>
  );
}
