import { createContext, useContext, useMemo, ReactNode } from 'react';

import { SpriteAudioEvent } from '../audio/types/audio-events';
import { useMicroAudio } from '../audio/micro';
import { useSpriteAudioEvents } from '../audio/sprites';

import { AudioProviderValue } from './AudioContext.types';

const AudioContext = createContext<AudioProviderValue | null>(null);

/**
 * Provider for audio system, combining micro and sprite audio.
 */
export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const micro = useMicroAudio();
  const { playSprite } = useSpriteAudioEvents();

  const value = useMemo<AudioProviderValue>(
    () => ({
      // Spread all micro audio methods and state
      ...micro,
      // Sprite audio generic
      playSprite,
      // Sprite audio convenience methods
      playBadgeEarned: () => playSprite(SpriteAudioEvent.BadgeEarned),
      playLevelUp: () => playSprite(SpriteAudioEvent.LevelUp),
      playStreakMaintained: () => playSprite(SpriteAudioEvent.StreakMaintained),
      playStreakBroken: () => playSprite(SpriteAudioEvent.StreakBroken),
      playAnswerCorrect: () => playSprite(SpriteAudioEvent.AnswerCorrect),
      playAnswerIncorrect: () => playSprite(SpriteAudioEvent.AnswerIncorrect),
      playVoiceRecordingStart: () => playSprite(SpriteAudioEvent.VoiceRecordingStart),
      playVoiceRecordingStop: () => playSprite(SpriteAudioEvent.VoiceRecordingStop),
      playVoiceResponseReceived: () => playSprite(SpriteAudioEvent.VoiceResponseReceived),
      playToastSuccess: () => playSprite(SpriteAudioEvent.ToastSuccess),
      playToastInfo: () => playSprite(SpriteAudioEvent.ToastInfo),
      playToastWarning: () => playSprite(SpriteAudioEvent.ToastWarning),
      playActivityStart: () => playSprite(SpriteAudioEvent.ActivityStart),
      playActivityComplete: () => playSprite(SpriteAudioEvent.ActivityComplete),
      playLessonStart: () => playSprite(SpriteAudioEvent.LessonStart),
      playLessonComplete: () => playSprite(SpriteAudioEvent.LessonComplete),
      playXPGain: () => playSprite(SpriteAudioEvent.XPGain),
      playErrorSubtle: () => playSprite(SpriteAudioEvent.ErrorSubtle),
      playCongrats: () => playSprite(SpriteAudioEvent.Congrats),
    }),
    [micro, playSprite],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

/**
 * Hook to access audio provider functions.
 * @throws {Error} If used outside of AudioProvider.
 */
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
