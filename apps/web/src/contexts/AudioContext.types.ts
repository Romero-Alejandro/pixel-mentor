import type { MicroAudioEvent, SpriteAudioEvent } from '../audio/types/audio-events';

export interface AudioProviderValue {
  // Micro audio methods
  playMicro: (event: MicroAudioEvent, customVolume?: number) => void;
  playClick: () => void;
  playClickSecondary: () => void;
  playHover: () => void;
  playToggleOn: () => void;
  playToggleOff: () => void;
  playSelect: () => void;
  playCheck: () => void;
  playRadio: () => void;
  playModalOpen: () => void;
  playModalClose: () => void;
  playFocus: () => void;
  playBlur: () => void;
  // Sprite audio methods
  playSprite: (event: SpriteAudioEvent) => void;
  playBadgeEarned: () => void;
  playLevelUp: () => void;
  playStreakMaintained: () => void;
  playStreakBroken: () => void;
  playAnswerCorrect: () => void;
  playAnswerIncorrect: () => void;
  playVoiceRecordingStart: () => void;
  playVoiceRecordingStop: () => void;
  playVoiceResponseReceived: () => void;
  playToastSuccess: () => void;
  playToastInfo: () => void;
  playToastWarning: () => void;
  playActivityStart: () => void;
  playActivityComplete: () => void;
  playLessonStart: () => void;
  playLessonComplete: () => void;
  playXPGain: () => void;
  playErrorSubtle: () => void;
  playCongrats: () => void;
  // Global state
  isMuted: boolean;
  toggleMute: () => void;
  volume: number;
  setVolume: (volume: number) => void;
}
