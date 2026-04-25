import { create } from 'zustand';

interface ClickerState {
  count: number;
  increment: () => void;
  reset: () => void;
  incrementBy: (amount: number) => void;
}

export const useClickerStore = create<ClickerState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
  incrementBy: (amount) => set((state) => ({ count: state.count + amount })),
}));
