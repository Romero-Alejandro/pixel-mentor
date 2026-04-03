import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useLessonState } from './useLessonState';
import { useChatStream } from './useChatStream';

import { FEEDBACK_DISPLAY_MS, estimateReadTime } from '@/config/lessonTiming';
import { api, streamInteractWithRecipe, type PedagogicalState } from '@/services/api';
import { useVoice, type VoiceSettings } from '@/hooks/useVoice';
import { useLessonStore } from '@/stores/lessonStore';

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
  const eventSourceRef = useRef<EventSource | null>(null);
  const isMountedRef = useRef(true);
  const streamingChunksRef = useRef<string[]>([]);
  const handlersRef = useRef({ chunk: null as any, end: null as any, error: null as any });
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    syncStore(isSpeaking);
  }, [isSpeaking, syncStore]);

  function cleanup() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (eventSourceRef.current) {
      const es = eventSourceRef.current;
      if (handlersRef.current.chunk) es.removeEventListener('chunk', handlersRef.current.chunk);
      if (handlersRef.current.end) es.removeEventListener('end', handlersRef.current.end);
      if (handlersRef.current.error) es.removeEventListener('error', handlersRef.current.error);
      es.close();
      eventSourceRef.current = null;
      handlersRef.current = { chunk: null, end: null, error: null };
    }
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
      speak(voiceText || extractText(activity?.instruction) || '', _voiceSettings).catch((e) =>
        console.error('[ClassOrchestrator] Speak error:', e),
      );
      return;
    }

    // If we were streaming, don't overwrite the progressively built text.
    // The `voiceText` is already set to the full accumulated text from the stream.
    if (!wasStreamingRef.current) {
      if (staticContent?.script) {
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
        setTransitionText(extractText(staticContent.script.transition));
        setContentText(extractText(staticContent.script.content));
        setClosureText(extractText(staticContent.script.closure));
      } else {
        setTransitionText('');
        setContentText(voiceText);
        setClosureText('');
      }
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

    timerRef.current = setTimeout(
      () => {
        if (!sessionIdRef.current || !isMountedRef.current) return;
        setIsProcessing(true);
        doInteract('continuar')
          .then(processResponse)
          .finally(() => setIsProcessing(false));
      },
      Math.max(0, totalDuration - elapsed),
    );
  }

  async function doInteract(input: string): Promise<LessonResponse> {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error('Sesión no activa');

    if (import.meta.env.VITE_ENABLE_STREAMING === 'true') {
      if (import.meta.env.DEV) {
        console.log('[useClassOrchestrator] doInteract: Streaming ENABLED, using EventSource');
      }
      try {
        abortControllerRef.current = new AbortController();
        const eventSource = streamInteractWithRecipe(sid, input);
        eventSourceRef.current = eventSource;

        let fullText = '';
        wasStreamingRef.current = true;
        setStoreStreaming(true);
        setStreamError(null);
        clearStream();
        setContentText('');

        handlersRef.current.chunk = (e: MessageEvent) => {
          if (!isMountedRef.current) return;
          try {
            const { text } = JSON.parse(e.data);
            fullText += text;
            streamingChunksRef.current = [...streamingChunksRef.current, text];
            setStreamingChunks(streamingChunksRef.current);
            // Desacoplar actualización de contentText para evitar batch de React
            setTimeout(() => {
              setContentText((prev) => prev + text);
            }, 0);
            if (import.meta.env.DEV) {
              console.log('[ClassOrchestrator] Chunk received:', {
                textLength: text.length,
                accumulatedLength: fullText.length,
                chunkNumber: streamingChunksRef.current.length,
                preview: text.slice(0, 30),
              });
            }
          } catch (e) {
            console.error('[ClassOrchestrator] Error in chunk handler:', e);
          }
        };

        handlersRef.current.end = (e: MessageEvent) => {
          if (!isMountedRef.current) return;
          setStoreStreaming(false);
          cleanup();
          try {
            const parsed = JSON.parse(e.data);
            processResponse({ voiceText: fullText, ...parsed });
          } catch (e) {
            console.error('[ClassOrchestrator] Error in end handler, falling back to POST:', e);
            api.interactWithRecipe(sid, input).then(processResponse);
          }
        };

        handlersRef.current.error = () => {
          if (!isMountedRef.current) return;
          console.error('[ClassOrchestrator] SSE error event received, falling back to POST');
          setStoreStreaming(false);
          cleanup();
          api.interactWithRecipe(sid, input).then(processResponse);
        };

        eventSource.addEventListener('chunk', handlersRef.current.chunk);
        eventSource.addEventListener('end', handlersRef.current.end);
        eventSource.addEventListener('error', handlersRef.current.error);
        eventSource.onerror = () => {
          if (!isMountedRef.current) return;
          console.error('[ClassOrchestrator] EventSource onerror triggered, falling back to POST');
          setStoreStreaming(false);
          cleanup();
          api.interactWithRecipe(sid, input).then(processResponse);
        };

        return {} as LessonResponse;
      } catch (error) {
        console.error(
          '[ClassOrchestrator] Failed to setup streaming, falling back to POST:',
          error,
        );
        return (await api.interactWithRecipe(sid, input)) as LessonResponse;
      }
    }
    return (await api.interactWithRecipe(sid, input)) as LessonResponse;
  }

  async function startClass(lessonId: string): Promise<Result<void, Error>> {
    console.log(
      '%c[DEBUG] startClass called',
      'color: cyan; font-weight: bold;',
      'lessonId:',
      lessonId,
    );
    console.log('%c[DEBUG] Stack trace:', 'color: cyan;');
    console.trace();
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

      // For resumed sessions (resumed=true and needsStart !== true), we need to:
      // 1. Speak the welcome message
      // 2. Also speak the current lesson content (from staticContent)
      // The welcome message should NOT overwrite the lesson content
      const isResumedSession = startResult.resumed === true && startResult.needsStart === false;

      if (isResumedSession) {
        // Extract the lesson content from staticContent
        const staticContent = startResult.staticContent;
        if (staticContent?.script) {
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

          const transition = extractText(staticContent.script.transition);
          const content = extractText(staticContent.script.content);
          const closure = extractText(staticContent.script.closure);
          const lessonContent = [transition, content, closure].filter(Boolean).join(' ');

          // Store the lesson content for later (not for display yet)
          contentRef.current = lessonContent;

          // FIRST: Show and speak just the welcome message
          const welcomeText = startResult.voiceText || '¡Bienvenido de vuelta!';
          setTransitionText('');
          setContentText(welcomeText);
          setClosureText('');
          setFullVoiceText(welcomeText);
          setFeedbackData(null);
          setUIState('concentration');

          // Speak just the welcome first
          await speak(welcomeText, _voiceSettings);

          // THEN: Update to show and speak the lesson content
          setTransitionText(transition);
          setContentText(content);
          setClosureText(closure);
          setFullVoiceText(lessonContent);
          contentRef.current = lessonContent;

          // Speak the lesson content
          await speak(lessonContent, _voiceSettings);

          // IMPORTANT: For resumed sessions, we need to call processResponse with the start result!
          processResponse(startResult as LessonResponse);
        } else {
          // Fallback: just speak the welcome
          setContentText(startResult.voiceText || '¡Bienvenido!');
          setFullVoiceText(startResult.voiceText || '¡Bienvenido!');
          speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch((e) =>
            console.error('[ClassOrchestrator] Speak error:', e),
          );
        }
      } else {
        // Normal start or start that needs "comenzar" confirmation
        speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch((e) =>
          console.error('[ClassOrchestrator] Speak error:', e),
        );

        // The startResult already contains the first step's content (staticContent).
        // We process it directly instead of making a redundant doInteract('comenzar')
        // call that would re-send the same step and cause a visible repetition.
        // The auto-advance in processResponse will then correctly trigger
        // doInteract('continuar') to move to the second step.
        processResponse(startResult as LessonResponse);
      }

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

      // Handle based on needsStart
      if (startResult.needsStart !== false) {
        speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch((e) =>
          console.error('[ClassOrchestrator] Speak error:', e),
        );
        const firstStep = await doInteract('comenzar');
        processResponse(firstStep);
      } else {
        // Process the start response directly for resumed sessions
        processResponse(startResult as LessonResponse);
      }
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
