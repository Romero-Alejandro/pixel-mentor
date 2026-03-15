import { create } from 'zustand';

import { type PedagogicalState } from '../services/api';

export interface LessonConfig {
  tutorName: string;
  maxQuestionsPerSession: number;
  questionCooldownSeconds: number;
  activityTimeoutSeconds: number;
  encouragementAfterInactivitySeconds: number;
  skipAfterFailedAttempts: number;
  skipAfterInactivitySeconds: number;
  enableActivitySkip: boolean;
  tone: 'friendly' | 'formal';
  greetings: {
    intro: string;
    readyPrompt: string;
    nextConceptTransition: string;
    completionMessage: string;
  };
  encouragementPhrases: string[];
  jokes: string[];
}

interface LessonState {
  lessonId: string | null;
  sessionId: string | null;
  currentState: PedagogicalState;
  contentText: string;
  isListening: boolean;
  isSpeaking: boolean;
  // Configuration from backend
  config: LessonConfig | null;
  // Student info
  studentName: string | null;
  // Session resume tracking
  wasResumed: boolean;
  setLessonId: (id: string | null) => void;
  setSessionId: (id: string | null) => void;
  setCurrentState: (state: PedagogicalState) => void;
  setContentText: (text: string) => void;
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setConfig: (config: LessonConfig | null) => void;
  setStudentName: (name: string | null) => void;
  setWasResumed: (resumed: boolean) => void;
  reset: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  lessonId: null,
  sessionId: null,
  currentState: 'AWAITING_START',
  contentText: '¡Hola! Vamos a aprender algo increíble hoy.',
  isListening: false,
  isSpeaking: false,
  config: null,
  studentName: null,
  wasResumed: false,
  setLessonId: (id) => set({ lessonId: id }),
  setSessionId: (id) => set({ sessionId: id }),
  setCurrentState: (state) => set({ currentState: state }),
  setContentText: (text) => set({ contentText: text }),
  setIsListening: (listening) => set({ isListening: listening }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setConfig: (config) => set({ config }),
  setStudentName: (name) => set({ studentName: name }),
  setWasResumed: (resumed) => set({ wasResumed: resumed }),
  reset: () =>
    set({
      lessonId: null,
      sessionId: null,
      currentState: 'AWAITING_START',
      contentText: '¡Hola! Vamos a aprender algo increíble hoy.',
      isListening: false,
      isSpeaking: false,
      config: null,
      studentName: null,
      wasResumed: false,
    }),
}));
