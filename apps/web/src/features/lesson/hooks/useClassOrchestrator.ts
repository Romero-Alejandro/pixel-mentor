import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EventSourceMessage } from '@microsoft/fetch-event-source';
import type { StartRecipeOutput } from '@pixel-mentor/shared';

import { FEEDBACK_DISPLAY_MS, estimateReadTime } from '../constants/lesson.constants';

import { useLessonState } from './useLessonState';
import { useChatStream } from './useChatStream';

import { api, streamInteractWithRecipe, type PedagogicalState } from '@/services/api';
import { logger } from '@/utils/logger';
import { useVoice, type VoiceSettings } from '@/features/voice/hooks/useVoice';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

interface LessonResponse {
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
  // Gamification data
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

let _voiceSettings: VoiceSettings = {};

export function useVoiceSettingsSync(settings: VoiceSettings): void {
  useEffect(() => {
    _voiceSettings = settings;
  }, [settings]);
}

export function useClassOrchestrator() {
  const {
    setSessionId,
    setCurrentState,
    setIsSpeaking: syncStore,
    setError,
    setStreamingChunks,
    setIsStreaming: setStoreStreaming,
    setStreamError,
    clearStream,
    setIsRepeat,
    setXpEarned,
    setAccuracy,
    isStreaming,
  } = useLessonStore(
    useShallow((state) => ({
      setSessionId: state.setSessionId,
      setCurrentState: state.setCurrentState,
      setIsSpeaking: state.setIsSpeaking,
      setError: state.setError,
      setStreamingChunks: state.setStreamingChunks,
      setIsStreaming: state.setIsStreaming,
      setStreamError: state.setStreamError,
      clearStream: state.clearStream,
      setIsRepeat: state.setIsRepeat,
      setXpEarned: state.setXpEarned,
      setAccuracy: state.setAccuracy,
      isStreaming: state.isStreaming,
    })),
  );

  const { stopStream } = useChatStream();
  const {
    speak,
    stopSpeaking: voiceStop,
    isSpeaking,
    getCurrentAudioElement: getAudio,
  } = useVoice();

  const {
    uiState,
    currentStep,
    totalSteps,
    contentText,
    questionText,
    options,
    feedbackData,
    isProcessing,
    setUIState,
    setCurrentStep,
    setTotalSteps,
    setContentText,
    setQuestionText,
    setOptions,
    setFeedbackData,
    setIsProcessing,
    resetState,
    questionResults,
    addQuestionResult,
  } = useLessonState();

  const [transitionText, setTransitionText] = useState('');
  const [closureText, setClosureText] = useState('');
  const [fullVoiceText, setFullVoiceText] = useState('');

  const sessionIdRef = useRef<string | null>(null);
  const lessonIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const streamingChunksRef = useRef<string[]>([]);
  const wasStreamingRef = useRef(false);
  const isInteractingRef = useRef(false); // Guard against concurrent doInteract calls
  const lastStepIndexRef = useRef<number | null>(null); // Track last step index to detect loops
  const sameStepCountRef = useRef(0); // Count consecutive same step occurrences
  const MAX_SAME_STEP_COUNT = 3; // Break loop after this many repetitions
  const contentStepsRef = useRef<
    Array<{
      stepIndex: number;
      stepType: string;
      staticContent: {
        stepType: string;
        script?: { transition: string; content: string; examples: string[]; closure: string };
        activity?: {
          instruction: string;
          options?: Array<{ text: string; isCorrect: boolean }>;
          feedback: { correct: string; incorrect: string };
        };
      };
    }>
  >([]);
  const contentStepIndexRef = useRef(0); // Current index in contentStepsRef

  useEffect(() => {
    syncStore(isSpeaking);
  }, [isSpeaking, syncStore]);

  function cleanup() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isInteractingRef.current = false; // Reset guard so new interactions can start
    stopStream();
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  async function processResponse(raw: LessonResponse): Promise<void> {
    if (!isMountedRef.current) return;

    // Skip blocked calls from the concurrency guard
    if ((raw as unknown as { _blocked?: boolean })?._blocked) return;

    const {
      voiceText = '',
      pedagogicalState = 'EXPLANATION',
      staticContent,
      isCorrect,
      feedback,
      sessionCompleted,
      lessonProgress,
      xpEarned,
      accuracy,
    } = raw;

    // ── Loop detection: track step index from lessonProgress ──────────────
    // If the same step index is received too many times, force-advance
    const currentStepIdx = lessonProgress?.currentStep ?? null;
    if (currentStepIdx !== null) {
      if (currentStepIdx === lastStepIndexRef.current) {
        sameStepCountRef.current++;
        if (sameStepCountRef.current >= MAX_SAME_STEP_COUNT) {
          console.error(
            `[ClassOrchestrator] LOOP DETECTED: Step ${currentStepIdx} repeated ${sameStepCountRef.current} times. Breaking loop by advancing.`,
          );
          sameStepCountRef.current = 0;
          lastStepIndexRef.current = null;
          setIsProcessing(true);
          doInteract('continuar')
            .then(processResponse)
            .catch((err) => {
              if (err?.message !== 'Interaction already in progress') {
                console.error('[ClassOrchestrator] Forced advance error:', err);
              }
            })
            .finally(() => setIsProcessing(false));
          return;
        }
      } else {
        sameStepCountRef.current = 0;
        lastStepIndexRef.current = currentStepIdx;
      }
    }

    if (lessonProgress) {
      setCurrentStep(lessonProgress.currentStep);
      setTotalSteps(lessonProgress.totalSteps);
    }
    setCurrentState(pedagogicalState);

    if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
      // Store gamification data
      if (xpEarned !== undefined) {
        setXpEarned(xpEarned);
      }
      if (accuracy) {
        setAccuracy(accuracy);
      }
      setUIState('completed');
      speak(voiceText || '¡Misión cumplida!', _voiceSettings).catch((e) =>
        console.error('[ClassOrchestrator] Speak error:', e),
      );
      return;
    }

    if (pedagogicalState === 'EVALUATION') {
      const msg = feedback || (isCorrect ? '¡Muy bien!' : '¡Sigue intentando!');
      // Calculate proportional XP per question
      const totalActivities = accuracy?.totalActivities || totalSteps || 1;
      const xpPerQuestion = Math.round((xpEarned ?? 50) / totalActivities);
      // Record this question's result
      addQuestionResult(questionText, !!isCorrect);
      setFeedbackData({
        isCorrect: !!isCorrect,
        message: msg,
        xpAwarded: isCorrect ? xpPerQuestion : undefined,
      });
      setUIState('feedback');

      const startTime = Date.now();
      await speak(voiceText || msg, _voiceSettings);
      const elapsed = Date.now() - startTime;
      const totalDuration = FEEDBACK_DISPLAY_MS + estimateReadTime(msg);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => {
          if (!isMountedRef.current) return;
          setIsProcessing(true);
          doInteract('continuar')
            .then(processResponse)
            .finally(() => setIsProcessing(false));
        },
        Math.max(0, totalDuration - elapsed),
      );
      return;
    }

    const activity = staticContent?.activity;
    const hasOptions = Array.isArray(activity?.options) && activity.options.length > 0;

    // Helper to extract text from string or {text: string} object
    const extractText = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (
        val &&
        typeof val === 'object' &&
        'text' in val &&
        typeof (val as { text: unknown }).text === 'string'
      ) {
        return (val as { text: string }).text;
      }
      return '';
    };

    if (pedagogicalState === 'ACTIVITY_WAIT') {
      setQuestionText(extractText(activity?.instruction));
      setOptions(
        hasOptions
          ? activity!.options!.map((o, i) => ({
              id: `opt-${i}`,
              text: o.text,
              isCorrect: o.isCorrect,
            }))
          : [],
      );
      setFeedbackData(null);
      setUIState(hasOptions ? 'activity' : 'question');

      // Update text fields for activity steps too
      if (staticContent?.script) {
        setTransitionText(extractText(staticContent.script.transition));
        setContentText(extractText(staticContent.script.content));
        setClosureText(extractText(staticContent.script.closure));
      }

      speak(voiceText || extractText(activity?.instruction) || '', _voiceSettings).catch((e) =>
        console.error('[ClassOrchestrator] Speak error:', e),
      );
      return;
    }

    // Update text fields from staticContent when available
    if (staticContent?.script) {
      setTransitionText(extractText(staticContent.script.transition));
      setContentText(extractText(staticContent.script.content));
      setClosureText(extractText(staticContent.script.closure));
    } else if (!wasStreamingRef.current) {
      setTransitionText('');
      setContentText(voiceText);
      setClosureText('');
    }

    // Reset the flag after use, so subsequent non-streaming interactions behave normally.
    wasStreamingRef.current = false;

    setFullVoiceText(voiceText);
    contentRef.current = voiceText;
    setFeedbackData(null);
    setUIState('concentration');

    const startTime = Date.now();
    await speak(voiceText, _voiceSettings);
    const elapsed = Date.now() - startTime;

    const totalDuration = estimateReadTime(voiceText);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => {
        if (!sessionIdRef.current || !isMountedRef.current) return;
        setIsProcessing(true);
        doInteract('continuar')
          .then(processResponse)
          .catch((err) => {
            // Silently ignore guard rejections — they mean a request is already in progress
            if (err?.message !== 'Interaction already in progress') {
              console.error('[ClassOrchestrator] Auto-advance error:', err);
            }
          })
          .finally(() => setIsProcessing(false));
      },
      Math.max(0, totalDuration - elapsed),
    );
  }

  async function doInteract(input: string): Promise<LessonResponse> {
    // Guard against concurrent calls (SSE error + onerror both firing)
    if (isInteractingRef.current) {
      // Return a sentinel that processResponse recognizes to skip timer setup
      return { _blocked: true } as unknown as LessonResponse;
    }
    isInteractingRef.current = true;

    const sid = sessionIdRef.current;
    if (!sid) {
      isInteractingRef.current = false;
      throw new Error('Sesión no activa');
    }

    if (import.meta.env.VITE_ENABLE_STREAMING === 'true') {
      logger.log('[useClassOrchestrator] doInteract: Streaming ENABLED, using fetchEventSource');
      try {
        let fullText = '';
        wasStreamingRef.current = true;
        setStoreStreaming(true);
        setStreamError(null);
        clearStream();
        setContentText('');

        // Promise-based resolution: resolves when stream ends, rejects on error
        let resolveStream: (value: LessonResponse) => void;
        let rejectStream: (reason: unknown) => void;
        const streamPromise = new Promise<LessonResponse>((resolve, reject) => {
          resolveStream = resolve;
          rejectStream = reject;
        });

        abortControllerRef.current = streamInteractWithRecipe(sid, input, {
          onMessage: (event: EventSourceMessage) => {
            if (!isMountedRef.current) return;
            try {
              const { text } = JSON.parse(event.data);
              fullText += text;
              streamingChunksRef.current = [...streamingChunksRef.current, text];
              setStreamingChunks(streamingChunksRef.current);
              setTimeout(() => {
                setContentText((prev) => prev + text);
              }, 0);
            } catch (e) {
              console.error('[ClassOrchestrator] Error in message handler:', e);
            }
          },
          onError: (_error: Error) => {
            if (!isMountedRef.current) return;
            // Only fallback once — onerror may fire redundantly
            if (!isInteractingRef.current) return;
            console.error('[ClassOrchestrator] SSE error received, falling back to POST');
            setStoreStreaming(false);
            cleanup();
            api
              .interactWithRecipe(sid, input)
              .then((res) => {
                isInteractingRef.current = false;
                resolveStream(res as LessonResponse);
              })
              .catch(rejectStream);
          },
          onClose: () => {
            if (!isMountedRef.current) return;
            setStoreStreaming(false);
            cleanup();
            try {
              // Try to parse the last message as the final response
              // If the backend sends an 'end' event with data, parse it
              // Otherwise, use the accumulated fullText
              isInteractingRef.current = false;
              resolveStream({ voiceText: fullText } as LessonResponse);
            } catch (e) {
              console.error('[ClassOrchestrator] Error in close handler, falling back to POST:', e);
              api
                .interactWithRecipe(sid, input)
                .then((res) => {
                  isInteractingRef.current = false;
                  resolveStream(res as LessonResponse);
                })
                .catch(rejectStream);
            }
          },
        });

        return await streamPromise;
      } catch (error) {
        console.error(
          '[ClassOrchestrator] Failed to setup streaming, falling back to POST:',
          error,
        );
        isInteractingRef.current = false;
        return (await api.interactWithRecipe(sid, input)) as LessonResponse;
      }
    }
    try {
      return (await api.interactWithRecipe(sid, input)) as LessonResponse;
    } finally {
      isInteractingRef.current = false;
    }
  }

  async function startClass(lessonId: string): Promise<Result<void, Error>> {
    logger.log('[useClassOrchestrator] startClass called', { lessonId });
    logger.debug('[useClassOrchestrator] Stack trace');
    cleanup();
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    lessonIdRef.current = lessonId;

    try {
      const startResult = await api.startRecipe(lessonId);

      sessionIdRef.current = startResult.sessionId;
      setSessionId(startResult.sessionId);
      setIsRepeat(startResult.isRepeat === true);

      if (!isMountedRef.current) return Ok(undefined);

      // Store content steps for reference (progress bar, etc.)
      const contentSteps: StartRecipeOutput['contentSteps'] = startResult.contentSteps ?? [];
      contentStepsRef.current = contentSteps as typeof contentStepsRef.current;
      contentStepIndexRef.current = 0;

      // Speak the welcome message
      speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch((e) =>
        console.error('[ClassOrchestrator] Speak error:', e),
      );

      // Don't call processResponse(startResult) — it has pedagogicalState: 'AWAITING_START'
      // which would show the same step 0 content again and create a duplicate timer.
      // Instead, directly advance to the first content step via the backend.
      // The AWAITING_START fast path will transition to EXPLANATION for step 0.
      const firstStep = await doInteract('continuar');
      processResponse(firstStep);

      return Ok(undefined);
    } catch (e) {
      if (isMountedRef.current) setIsProcessing(false);
      return Err(e instanceof Error ? e : new Error('Failed to start lesson'));
    }
  }

  async function submitAnswer(answer: string) {
    if (!sessionIdRef.current || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await doInteract(answer);
      processResponse(res);
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }

  function reset() {
    cleanup();
    sessionIdRef.current = null;
    contentRef.current = '';
    resetState();
    setSessionId(null);
    setCurrentState('AWAITING_START');
    setError(null);
    clearStream();
  }

  async function resetSession() {
    const sid = sessionIdRef.current;
    const lid = lessonIdRef.current;
    if (!sid || !lid) return;

    try {
      await api.resetSession(sid);
      // After resetting, restart the lesson
      cleanup();
      abortControllerRef.current = new AbortController();
      setIsProcessing(true);

      const startResult = await api.startRecipe(lid);
      sessionIdRef.current = startResult.sessionId;
      setSessionId(startResult.sessionId);
      setIsRepeat(startResult.isRepeat === true);

      if (!isMountedRef.current) return;

      // Same logic as startClass: process startResult directly without
      // redundant doInteract('comenzar') call that causes step repetition
      speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch((e) =>
        console.error('[ClassOrchestrator] Speak error:', e),
      );
      processResponse(startResult as LessonResponse);
    } catch (e) {
      console.error('[resetSession] Failed:', e);
      if (isMountedRef.current) setIsProcessing(false);
    }
  }

  function speakContent() {
    if (contentRef.current) speak(contentRef.current, _voiceSettings).catch(() => {});
  }

  return {
    uiState,
    currentStep,
    totalSteps,
    contentText,
    transitionText,
    closureText,
    fullVoiceText,
    questionText,
    options,
    feedback: feedbackData,
    isProcessing,
    isSpeaking,
    isStreaming, // Add streaming flag
    questionResults,
    startClass,
    submitAnswer,
    speakContent,
    stopSpeaking: voiceStop,
    reset,
    resetSession,
    getCurrentAudioElement: getAudio,
  };
}
