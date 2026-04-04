// ZzFX - Zuper Zmall Zound Zynth
import { MicroAudioEvent } from '../types/audio-events';
import { useAudioStore } from '../../features/audio/stores/audio.store';
import { logger } from '@/utils/logger';

let audioCtx: AudioContext | null = null;

interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * ZzFX Sound Generator
 */
export const zzfx = (...parameters: number[]) => {
  if (!audioCtx) {
    try {
      const AudioCtx = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API not available');
      }
      audioCtx = new AudioCtx();
    } catch (e) {
      logger.warn('Web Audio API not supported', e);
      return;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const [volume, _pan, frequency, attack, decay, release] = parameters;
  if (!frequency) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  const startTime = audioCtx.currentTime;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + Math.max(attack, 0.001));
  gainNode.gain.linearRampToValueAtTime(
    0,
    startTime + Math.max(attack, 0.001) + Math.max(decay, 0.001) + Math.max(release, 0.001),
  );

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(startTime);
  oscillator.stop(
    startTime + Math.max(attack, 0.001) + Math.max(decay, 0.001) + Math.max(release, 0.001),
  );
};

const MICRO_SOUND_PARAMS: Record<MicroAudioEvent, number[]> = {
  [MicroAudioEvent.Click]: [0.5, 0, 100, 0.01, 0.01, 0.01],
  [MicroAudioEvent.ClickSecondary]: [0.25, 0, 100, 0.01, 0.01, 0.01],
  [MicroAudioEvent.ToggleOn]: [0.5, 0, 100, 0.01, 0.01, 0.01],
  [MicroAudioEvent.ToggleOff]: [0.5, 0, 100, 0.01, 0.01, 0.01],
  [MicroAudioEvent.Focus]: [0.4, 0, 100, 0.01, 0.01, 0.01],
  [MicroAudioEvent.InputFocus]: [0.15, 0, 200, 0.01, 0.01, 0.01],
  [MicroAudioEvent.InputBlur]: [0.15, 0, 150, 0.01, 0.01, 0.01],
  [MicroAudioEvent.CheckboxCheck]: [0.25, 0, 600, 0.01, 0.01, 0.01],
  [MicroAudioEvent.RadioSelect]: [0.25, 0, 700, 0.01, 0.01, 0.01],
  [MicroAudioEvent.HoverOption]: [0.1, 0, 800, 0.01, 0.01, 0.01],
  [MicroAudioEvent.DropdownToggle]: [0.25, 0, 300, 0.01, 0.01, 0.01],
  [MicroAudioEvent.SelectOption]: [0.25, 0, 400, 0.01, 0.01, 0.01],
  [MicroAudioEvent.ModalOpen]: [0.6, 0, 500, 0.01, 0.01, 0.01],
  [MicroAudioEvent.ModalClose]: [0.35, 0, 250, 0.01, 0.01, 0.01],
};

/**
 * Generates sound based on event parameters
 */
export const playMicroSound = (event: MicroAudioEvent, customVolume?: number): void => {
  const { isMuted, volume, isInitialized, setInitialized } = useAudioStore.getState();
  if (isMuted) return;

  if (!isInitialized) {
    setInitialized(true);
  }

  const params = MICRO_SOUND_PARAMS[event];
  if (params) {
    const finalVolume = (customVolume ?? volume) * params[0];
    zzfx(finalVolume, params[1], params[2], params[3], params[4], params[5]);
  }
};
