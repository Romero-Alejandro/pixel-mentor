import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EventSourceMessage } from '@microsoft/fetch-event-source';
import type { StartRecipeOutput } from '@pixel-mentor/shared';

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
  // autoAdvance removed - frontend determines auto-advance from pedagogicalState
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
    logger.log('[useClassOrchestrator] processResponse called', {
      pedagogicalState: (raw as any).pedagogicalState,
      voiceText: (raw as any).voiceText?.substring(0, 50),
      autoAdvance: (raw as any).autoAdvance,
      staticContent: (raw as any).staticContent?.stepType,
    });

    const {
      voiceText = '',
      pedagogicalState = 'EXPLANATION',
      staticContent,
      isCorrect,
      feedback,
      sessionCompleted,
      lessonProgress,
      // autoAdvance now computed from pedagogicalState (see below)
      xpEarned,
      accuracy,
    } = raw;

    // DEBUG: Log raw response
    logger.log('[useClassOrchestrator] processResponse INPUT', {
      raw_pedagogicalState: raw.pedagogicalState,
      raw_sessionCompleted: raw.sessionCompleted,
      voiceText: voiceText?.substring(0, 50),
    });

    // AUTO-ADVANCE LOGIC: Simple and deterministic
    // - Content states (EXPLANATION, CLARIFYING, etc.): auto-advance
    // - Interactive states (ACTIVITY_WAIT, QUESTION, EVALUATION): wait for user
    // - AWAITING_START: wait for user confirmation
    const state = pedagogicalState as string;
    const needsUserInput =
      state === 'ACTIVITY_WAIT' ||
      state === 'QUESTION' ||
      state === 'EVALUATION' ||
      state === 'AWAITING_START'; // AWAITING_START needs user confirmation
    const canAutoAdvance = !needsUserInput && !sessionCompleted;

    // DEBUG: Log computed values
    logger.log('[useClassOrchestrator] processResponse COMPUTED', {
      state,
      needsUserInput,
      sessionCompleted,
      canAutoAdvance,
    });

    // Simply update state and speak - NO business logic
    // The backend drives the flow via pedagogicalState
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

    // EVALUATION: Show feedback but WAIT for backend to drive next transition
    // NO auto-advance - backend sends next pedagogicalState when ready
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

      // Just speak - NO auto-advance
      await speak(voiceText || msg, _voiceSettings);
      // Wait for user input or backend push - NO timer
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

    setFullVoiceText(voiceText);
    contentRef.current = voiceText;
    setFeedbackData(null);
    setUIState('concentration');

    // Speak the content and wait for completion
    await speak(voiceText, _voiceSettings);

    // AUTO-ADVANCE: After TTS completes, automatically advance if safe
    // Uses canAutoAdvance computed at the top of processResponse
    logger.log('[useClassOrchestrator] Before auto-advance check', {
      canAutoAdvance,
      state,
      voiceTextLen: voiceText?.length,
    });

    if (canAutoAdvance) {
      logger.log('[useClassOrchestrator] AUTO-ADVANCE TRIGGERED', {
        state,
        canAutoAdvance,
      });
      const next = await doInteract('__auto__');
      logger.log('[useClassOrchestrator] doInteract returned', {
        nextState: next.pedagogicalState,
        nextSessionCompleted: next.sessionCompleted,
      });
      processResponse(next);
      return;
    }

    // AWAITING_START: One-time trigger to start the lesson (first interaction only)
    // After this, the lesson flows automatically via canAutoAdvance
    if (pedagogicalState === 'AWAITING_START' && !sessionCompleted) {
      logger.log('[useClassOrchestrator] AWAITING_START TRIGGERED', {
        state,
        sessionCompleted,
      });
      const next = await doInteract('listo');
      logger.log('[useClassOrchestrator] doInteract returned', {
        nextState: next.pedagogicalState,
        nextSessionCompleted: next.sessionCompleted,
      });
      processResponse(next);
    }
  }

  async function doInteract(input: string, retries = 3): Promise<LessonResponse> {
    logger.log('[useClassOrchestrator] doInteract called', { input, isProcessing, retries });

    // Guard against concurrent calls (SSE error + onerror both firing)
    if (isInteractingRef.current) {
      logger.warn('[useClassOrchestrator] doInteract BLOCKED - already processing');
      // Return a sentinel that processResponse recognizes to skip timer setup
      return { _blocked: true } as unknown as LessonResponse;
    }
    isInteractingRef.current = true;

    const sid = sessionIdRef.current;
    if (!sid) {
      isInteractingRef.current = false;
      logger.error('[useClassOrchestrator] doInteract: No sessionId');
      throw new Error('Sesión no activa');
    }

    // Helper function to make the API call with retry logic
    async function callAPI(): Promise<LessonResponse> {
      if (import.meta.env.VITE_ENABLE_STREAMING === 'true') {
        logger.log('[useClassOrchestrator] doInteract: Streaming ENABLED, using fetchEventSource', {
          sid,
          input,
        });
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

          abortControllerRef.current = streamInteractWithRecipe(sid!, input, {
            onMessage: (event: EventSourceMessage) => {
              if (!isMountedRef.current) return;
              try {
                // Log raw event for debugging
                logger.log('[useClassOrchestrator] SSE event received', {
                  eventType: event.event,
                  dataPreview: event.data?.substring(0, 100),
                });

                const data = JSON.parse(event.data);

                // Check the EVENT TYPE (event.event), not data.type
                if (event.event === 'end') {
                  logger.log('[useClassOrchestrator] END event received', {
                    pedagogicalState: data.pedagogicalState,
                    staticContent: data.staticContent?.stepType,
                  });
                  resolveStream(data as LessonResponse);
                  return;
                }

                // Handle 'chunk' event for streaming text
                if (event.event === 'chunk') {
                  fullText += data.text || '';
                  setContentText(fullText);
                  return;
                }

                // Handle 'error' event
                if (event.event === 'error') {
                  logger.error('[useClassOrchestrator] SSE error event', { data });
                  rejectStream(new Error(data.message || 'Stream error'));
                  return;
                }
              } catch (e) {
                logger.error('[useClassOrchestrator] SSE parse error', { e, data: event.data });
                rejectStream(e);
              }
            },
            onError: (error: Error) => {
              logger.error('[useClassOrchestrator] SSE onError', { error: error.message });
              if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
                logger.warn('[useClassOrchestrator] Rate limited (429), will retry...');
                rejectStream(error);
              } else {
                rejectStream(error);
              }
            },
            onClose: () => {
              logger.log('[useClassOrchestrator] Stream closed');
            },
          });

          return await streamPromise;
        } catch (error) {
          const err = error as any;
          // Check if it's a 429 error and we have retries left
          if (retries > 0 && (err?.response?.status === 429 || err?.message?.includes('429'))) {
            const backoffMs = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
            logger.warn(`[useClassOrchestrator] Rate limited, retrying in ${backoffMs}ms...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            return doInteract(input, retries - 1);
          }
          console.error(
            '[ClassOrchestrator] Failed to setup streaming, falling back to POST:',
            error,
          );
          isInteractingRef.current = false;
          return (await api.interactWithRecipe(sid!, input)) as LessonResponse;
        }
      }
      try {
        return (await api.interactWithRecipe(sid!, input)) as LessonResponse;
      } finally {
        isInteractingRef.current = false;
      }
    }

    return await callAPI();
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

      // Simply process the start result - the backend returns AWAITING_START
      // The frontend's auto-advance logic will handle transitioning to the first step
      // No need to manually send 'continuar' - that was causing double advancement
      processResponse(startResult);

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
