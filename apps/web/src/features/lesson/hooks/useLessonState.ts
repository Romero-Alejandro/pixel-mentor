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
};

export function useLessonState() {
  const [uiState, setUIState] = useState<UIState>(INITIAL_STATE.uiState);
  const [currentStep, setCurrentStep] = useState(INITIAL_STATE.currentStep);
  const [totalSteps, setTotalSteps] = useState(INITIAL_STATE.totalSteps);
  const [contentText, setContentText] = useState(INITIAL_STATE.contentText);
  const [questionText, setQuestionText] = useState(INITIAL_STATE.questionText);
  const [options, setOptions] = useState<Option[]>(INITIAL_STATE.options);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(INITIAL_STATE.feedbackData);
  const [isProcessing, setIsProcessing] = useState(INITIAL_STATE.isProcessing);

  const resetState = useCallback(() => {
    setUIState(INITIAL_STATE.uiState);
    setCurrentStep(INITIAL_STATE.currentStep);
    setTotalSteps(INITIAL_STATE.totalSteps);
    setContentText(INITIAL_STATE.contentText);
    setQuestionText(INITIAL_STATE.questionText);
    setOptions(INITIAL_STATE.options);
    setFeedbackData(INITIAL_STATE.feedbackData);
    setIsProcessing(INITIAL_STATE.isProcessing);
  }, []);

  return {
    uiState,
    setUIState,
    currentStep,
    setCurrentStep,
    totalSteps,
    setTotalSteps,
    contentText,
    setContentText,
    questionText,
    setQuestionText,
    options,
    setOptions,
    feedbackData,
    setFeedbackData,
    isProcessing,
    setIsProcessing,
    resetState,
  };
}
