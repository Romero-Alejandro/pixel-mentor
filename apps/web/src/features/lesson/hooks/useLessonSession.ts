import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { PedagogicalState } from '@/services/api';

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

export interface LessonSession {
  sessionId: string;
  lessonId: string;
  pedagogicalState: PedagogicalState;
  contentText: string;
  config: LessonConfig | null;
  studentName: string | null;
  wasResumed: boolean;
  isRepeat: boolean;
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
  currentStep: number;
  totalSteps: number;
}

export interface InteractResponse {
  voiceText?: string;
  pedagogicalState?: PedagogicalState;
  isCorrect?: boolean | null;
  feedback?: string;
  sessionCompleted?: boolean;
  lessonProgress?: { currentStep: number; totalSteps: number };
  staticContent?: {
    script?: {
      transition?: string | { text: string };
      content?: string | { text: string };
      closure?: string | { text: string };
      question?: string | { text: string };
      expectedAnswer?: string;
    };
    activity?: {
      instruction: string | { text: string };
      options?: Array<{ text: string; isCorrect: boolean }>;
    };
  };
  xpEarned?: number;
  accuracy?: {
    correctFirstAttempts: number;
    correctLastAttempts: number;
    totalActivities: number;
    skippedActivities: number;
    accuracyPercent: number;
    allCorrectOnFirstAttempt: boolean;
    tier: 'perfect' | 'high' | 'medium' | 'low';
  };
}

export function useLessonSession(sessionId: string | null) {
  const queryClient = useQueryClient();

  // Query for session state
  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh for session state
  });

  // Mutation for start lesson
  const startMutation = useMutation({
    mutationFn: (recipeId: string) => api.startRecipeDemo(recipeId),
    onSuccess: (data) => {
      // Store recipeId in a separate query for reference
      queryClient.setQueryData(['startData', data.sessionId], {
        recipeId: startMutation.variables,
      });
      queryClient.setQueryData(['session', data.sessionId], {
        sessionId: data.sessionId,
        lessonId: startMutation.variables, // recipeId passed to mutation
        pedagogicalState: data.pedagogicalState,
        contentText: data.voiceText || '',
        config: data.meta?.config || null,
        studentName: null,
        wasResumed: data.isRepeat,
        isRepeat: data.isRepeat === true,
        xpEarned: null,
        accuracy: null,
        currentStep: data.lessonProgress?.currentStep || 0,
        totalSteps: data.lessonProgress?.totalSteps || data.contentSteps?.length || 0,
      });
    },
  });

  // Mutation for interact
  const interactMutation = useMutation({
    mutationFn: (data: { sessionId: string; studentInput: string }) =>
      api.interactWithRecipe(data.sessionId, data.studentInput) as Promise<InteractResponse>,
    onSuccess: (response) => {
      if (!sessionId) return;
      // Update session cache with new state
      queryClient.setQueryData(['session', sessionId], (old: LessonSession | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pedagogicalState: response.pedagogicalState || old.pedagogicalState,
          contentText: response.voiceText || old.contentText,
          xpEarned: response.xpEarned ?? old.xpEarned,
          accuracy: response.accuracy ?? old.accuracy,
          currentStep: response.lessonProgress?.currentStep ?? old.currentStep,
          totalSteps: response.lessonProgress?.totalSteps ?? old.totalSteps,
        };
      });
    },
  });

  // Mutation for reset session
  const resetMutation = useMutation({
    mutationFn: (sessionId: string) => api.resetSession(sessionId),
  });

  return {
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    isError: sessionQuery.isError,
    start: startMutation.mutateAsync,
    interact: interactMutation.mutateAsync,
    reset: resetMutation.mutateAsync,
    isStarting: startMutation.isPending,
    isInteracting: interactMutation.isPending,
    isResetting: resetMutation.isPending,
    startError: startMutation.error,
    interactError: interactMutation.error,
    refetchSession: sessionQuery.refetch,
  };
}

export function useStartLesson() {
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: (recipeId: string) => api.startRecipeDemo(recipeId),
    onSuccess: (data) => {
      // Store recipeId in a separate query for reference
      queryClient.setQueryData(['startData', data.sessionId], {
        recipeId: startMutation.variables,
      });
      // Set session data in cache
      queryClient.setQueryData(['session', data.sessionId], {
        sessionId: data.sessionId,
        lessonId: startMutation.variables, // recipeId passed to mutation
        pedagogicalState: data.pedagogicalState,
        contentText: data.voiceText || '',
        config: data.meta?.config || null,
        studentName: null,
        wasResumed: data.isRepeat,
        isRepeat: data.isRepeat === true,
        xpEarned: null,
        accuracy: null,
        currentStep: data.lessonProgress?.currentStep || 0,
        totalSteps: data.lessonProgress?.totalSteps || data.contentSteps?.length || 0,
      });
    },
  });

  return {
    start: startMutation.mutateAsync,
    startAsync: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    startError: startMutation.error,
  };
}

export function useInteractLesson(sessionId: string) {
  const queryClient = useQueryClient();

  const interactMutation = useMutation({
    mutationFn: (studentInput: string) =>
      api.interactWithRecipe(sessionId, studentInput) as Promise<InteractResponse>,
    onSuccess: (response) => {
      // Update session cache with new state
      queryClient.setQueryData(['session', sessionId], (old: LessonSession | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pedagogicalState: response.pedagogicalState || old.pedagogicalState,
          contentText: response.voiceText || old.contentText,
          xpEarned: response.xpEarned ?? old.xpEarned,
          accuracy: response.accuracy ?? old.accuracy,
          currentStep: response.lessonProgress?.currentStep ?? old.currentStep,
          totalSteps: response.lessonProgress?.totalSteps ?? old.totalSteps,
        };
      });
    },
  });

  return {
    interact: interactMutation.mutateAsync,
    isInteracting: interactMutation.isPending,
    interactError: interactMutation.error,
  };
}
