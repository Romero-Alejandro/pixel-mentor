import { MicroAudioEvent } from '../types/audio-events';
import { useAudioStore } from '../../features/audio/stores/audio.store';

import { playMicroSound } from './zzfx';

/**
 * Hook to play micro sounds.
 * Provides both generic playMicro(event) and convenience methods for each event.
 */
export const useMicroAudio = () => {
  const store = useAudioStore();

  const play = (event: MicroAudioEvent, customVolume?: number) => {
    if (store.isMuted) return;
    playMicroSound(event, customVolume);
  };

  return {
    playMicro: play,
    playClick: () => play(MicroAudioEvent.Click),
    playClickSecondary: () => play(MicroAudioEvent.ClickSecondary),
    playHover: () => play(MicroAudioEvent.HoverOption),
    playToggleOn: () => play(MicroAudioEvent.ToggleOn),
    playToggleOff: () => play(MicroAudioEvent.ToggleOff),
    playSelect: () => play(MicroAudioEvent.SelectOption),
    playCheck: () => play(MicroAudioEvent.CheckboxCheck),
    playRadio: () => play(MicroAudioEvent.RadioSelect),
    playModalOpen: () => play(MicroAudioEvent.ModalOpen),
    playModalClose: () => play(MicroAudioEvent.ModalClose),
    playFocus: () => play(MicroAudioEvent.InputFocus),
    playBlur: () => play(MicroAudioEvent.InputBlur),
    isMuted: store.isMuted,
    toggleMute: store.toggleMute,
    volume: store.volume,
    setVolume: store.setVolume,
  };
};
