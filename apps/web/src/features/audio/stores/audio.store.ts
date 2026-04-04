import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioState {
  volume: number;
  isMuted: boolean;
  isInitialized: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setInitialized: (isInitialized: boolean) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      volume: 0.8,
      isMuted: false,
      isInitialized: false,
      setVolume: (volume) => set({ volume }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setInitialized: (isInitialized) => set({ isInitialized }),
    }),
    {
      name: 'audio-settings',
    },
  ),
);
