import { useState, useCallback } from 'react';

export type UIState = 'idle' | 'concentration' | 'question' | 'activity' | 'feedback' | 'completed';

export interface Option {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface FeedbackData {
  isCorrect: boolean;
  message: string;
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
  feedbackData: null as FeedbackData | null,
  isProcessing: false,
  questionResults: [] as QuestionResult[],
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
  const setFeedbackData = useCallback(
    (val: FeedbackData | null) => updateState({ feedbackData: val }),
    [updateState],
  );
  const setIsProcessing = useCallback(
    (val: boolean) => updateState({ isProcessing: val }),
    [updateState],
  );

  return {
    ...state,
    updateState,
    setUIState,
    setCurrentStep,
    setTotalSteps,
    setContentText,
    setQuestionText,
    setOptions,
    setFeedbackData,
    setIsProcessing,
    addQuestionResult,
    resetState,
  };
}
