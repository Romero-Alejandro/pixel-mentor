import { useState, useCallback } from 'react';

import type { ActivityFormat } from '@pixel-mentor/shared/activities';

export type UIState = 'idle' | 'concentration' | 'question' | 'activity' | 'feedback' | 'completed';

export interface Option {
  id: string;
  text: string;
}

export interface OrderingItemView {
  id: string;
  text: string;
}

export interface FeedbackData {
  isCorrect: boolean;
  message: string;
  /** Id of the correct option, revealed by the backend AFTER grading. */
  correctOptionId?: string;
  /** Format-generic reveal for Fase 1 formats (ids/booleans/sequences). */
  correctAnswer?: unknown;
  /** Activity format of the graded step, when applicable. */
  activityFormat?: ActivityFormat | string;
  /** Partial score 0..1 for multi-answer formats. */
  score?: number;
  encouragement?: string;
  xpAwarded?: number;
}

export interface QuestionResult {
  question: string;
  isCorrect: boolean;
}

const INITIAL_STATE = {
  uiState: 'idle' as UIState,
  currentStep: 0,
  totalSteps: 0,
  contentText: '',
  questionText: '',
  options: [] as Option[],
  /** ordering format: shuffled items for the student to reorder. */
  orderingItems: [] as OrderingItemView[],
  /** Activity plugin format of the current step (null = legacy mcq_single). */
  activityFormat: null as ActivityFormat | string | null,
  feedbackData: null as FeedbackData | null,
  isProcessing: false,
  questionResults: [] as QuestionResult[],
  error: null as string | null,
};

export function useLessonState() {
  const [state, setState] = useState(INITIAL_STATE);

  const updateState = useCallback((updates: Partial<typeof INITIAL_STATE>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const addQuestionResult = useCallback((question: string, isCorrect: boolean) => {
    setState((prev) => ({
      ...prev,
      questionResults: [...prev.questionResults, { question, isCorrect }],
    }));
  }, []);

  // Compatibilidad hacia atrás (hasta refactorizar orquestador por completo)
  const setUIState = useCallback((val: UIState) => updateState({ uiState: val }), [updateState]);
  const setCurrentStep = useCallback(
    (val: number) => updateState({ currentStep: val }),
    [updateState],
  );
  const setTotalSteps = useCallback(
    (val: number) => updateState({ totalSteps: val }),
    [updateState],
  );
  const setContentText = useCallback(
    (val: string) => updateState({ contentText: val }),
    [updateState],
  );
  const setQuestionText = useCallback(
    (val: string) => updateState({ questionText: val }),
    [updateState],
  );
  const setOptions = useCallback((val: Option[]) => updateState({ options: val }), [updateState]);
  const setOrderingItems = useCallback(
    (val: OrderingItemView[]) => updateState({ orderingItems: val }),
    [updateState],
  );
  const setActivityFormat = useCallback(
    (val: ActivityFormat | string | null) => updateState({ activityFormat: val }),
    [updateState],
  );
  const setFeedbackData = useCallback(
    (val: FeedbackData | null) => updateState({ feedbackData: val }),
    [updateState],
  );
  const setIsProcessing = useCallback(
    (val: boolean) => updateState({ isProcessing: val }),
    [updateState],
  );
  const setError = useCallback((val: string | null) => updateState({ error: val }), [updateState]);

  return {
    ...state,
    updateState,
    setUIState,
    setCurrentStep,
    setTotalSteps,
    setContentText,
    setQuestionText,
    setOptions,
    setOrderingItems,
    setActivityFormat,
    setFeedbackData,
    setIsProcessing,
    setError,
    addQuestionResult,
    resetState,
  };
}
