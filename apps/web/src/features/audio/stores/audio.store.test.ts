import { describe, it, expect, beforeEach } from 'vitest';

import { useAudioStore } from './audio.store';

describe('audio.store', () => {
  beforeEach(() => {
    useAudioStore.setState({ volume: 0.5, isMuted: false });
  });

  it('should toggle mute state', () => {
    const { toggleMute } = useAudioStore.getState();
    toggleMute();
    expect(useAudioStore.getState().isMuted).toBe(true);
    toggleMute();
    expect(useAudioStore.getState().isMuted).toBe(false);
  });

  it('should update volume', () => {
    const { setVolume } = useAudioStore.getState();
    setVolume(0.8);
    expect(useAudioStore.getState().volume).toBe(0.8);
  });
});
