import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type PedagogicalState } from '@/services/api';

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
  // Repeat tracking (lesson was completed before)
  isRepeat: boolean;
  // Gamification data
  xpEarned: number | null;
  accuracy: {
    correctFirstAttempts: number;
    correctLastAttempts: number;
    totalActivities: number;
    skippedActivities: number;
    accuracyPercent: number;
    allCorrectOnFirstAttempt: boolean;
    tier: 'perfect' | 'high' | 'medium' | 'low';
  } | null;
  // Auto-start state
  isStarting: boolean;
  error: string | null;
  retryCount: number;
  // Streaming state
  streamingChunks: string[];
  isStreaming: boolean;
  streamError: string | null;

  // Actions
  setLessonId: (id: string | null) => void;
  setSessionId: (id: string | null) => void;
  setCurrentState: (state: PedagogicalState) => void;
  setContentText: (text: string) => void;
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setConfig: (config: LessonConfig | null) => void;
  setStudentName: (name: string | null) => void;
  setWasResumed: (resumed: boolean) => void;
  setIsRepeat: (repeat: boolean) => void;
  setXpEarned: (xp: number | null) => void;
  setAccuracy: (accuracy: LessonState['accuracy']) => void;
  setIsStarting: (starting: boolean) => void;
  setError: (error: string | null) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  // Streaming actions
  setStreamingChunks: (chunks: string[]) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamError: (error: string | null) => void;
  clearStream: () => void;
  reset: () => void;
}

const initialState = {
  lessonId: null,
  sessionId: null,
  currentState: 'AWAITING_START' as PedagogicalState,
  contentText: '¡Hola! Vamos a aprender algo increíble hoy.',
  isListening: false,
  isSpeaking: false,
  config: null,
  studentName: null,
  wasResumed: false,
  isRepeat: false,
  xpEarned: null,
  accuracy: null,
  isStarting: false,
  error: null,
  retryCount: 0,
  // Streaming initial state
  streamingChunks: [],
  isStreaming: false,
  streamError: null,
};

export const useLessonStore = create<LessonState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setLessonId: (id) => set({ lessonId: id }),
      setSessionId: (id) => set({ sessionId: id }),
      setCurrentState: (state) => set({ currentState: state }),
      setContentText: (text) => set({ contentText: text }),
      setIsListening: (listening) => set({ isListening: listening }),
      setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
      setConfig: (config) => set({ config }),
      setStudentName: (name) => set({ studentName: name }),
      setWasResumed: (resumed) => set({ wasResumed: resumed }),
      setIsRepeat: (repeat) => set({ isRepeat: repeat }),
      setXpEarned: (xp) => set({ xpEarned: xp }),
      setAccuracy: (accuracy) => set({ accuracy }),
      setIsStarting: (starting) => set({ isStarting: starting }),
      setError: (error) => set({ error }),
      incrementRetryCount: () => set((state) => ({ retryCount: state.retryCount + 1 })),
      resetRetryCount: () => set({ retryCount: 0 }),
      // Streaming actions
      setStreamingChunks: (chunks) => set({ streamingChunks: chunks }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setStreamError: (error) => set({ streamError: error }),
      clearStream: () => set({ streamingChunks: [], isStreaming: false, streamError: null }),
      reset: () =>
        set({
          ...initialState,
          config: get().config,
        }),
    }),
    {
      name: 'lesson-storage',
      partialize: (state) => ({ config: state.config }),
    },
  ),
);
