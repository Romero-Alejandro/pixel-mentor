import { create } from 'zustand';

import { type PedagogicalState } from '../services/api';

interface LessonState {
  lessonId: string | null;
  currentState: PedagogicalState;
  isListening: boolean;
  isSpeaking: boolean;
  setLessonId: (id: string | null) => void;
  setCurrentState: (state: PedagogicalState) => void;
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  reset: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  lessonId: null,
  currentState: 'ACTIVE_CLASS',
  isListening: false,
  isSpeaking: false,
  setLessonId: (id) => set({ lessonId: id }),
  setCurrentState: (state) => set({ currentState: state }),
  setIsListening: (listening) => set({ isListening: listening }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  reset: () =>
    set({
      lessonId: null,
      currentState: 'ACTIVE_CLASS',
      isListening: false,
      isSpeaking: false,
    }),
}));
