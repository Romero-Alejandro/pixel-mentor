import { create } from 'zustand';

export type EstadoPedagogico = 'EXPLICACION' | 'PREGUNTA' | 'EVALUACION';

interface LessonState {
  leccionId: string | null;
  currentState: EstadoPedagogico;
  isListening: boolean;
  isSpeaking: boolean;
  lastResponse: string | null;
  error: string | null;

  setLeccionId: (id: string) => void;
  setCurrentState: (state: EstadoPedagogico) => void;
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setLastResponse: (response: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  leccionId: null,
  currentState: 'EXPLICACION',
  isListening: false,
  isSpeaking: false,
  lastResponse: null,
  error: null,

  setLeccionId: (id) => set({ leccionId: id }),
  setCurrentState: (state) => set({ currentState: state }),
  setIsListening: (listening) => set({ isListening: listening }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setLastResponse: (response) => set({ lastResponse: response }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      leccionId: null,
      currentState: 'EXPLICACION',
      isListening: false,
      isSpeaking: false,
      lastResponse: null,
      error: null,
    }),
}));
