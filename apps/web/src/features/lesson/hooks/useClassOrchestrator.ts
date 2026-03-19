import { useCallback, useEffect, useRef, useState } from 'react';

import { FEEDBACK_DISPLAY_MS, estimateReadTime } from '@/config/lessonTiming';

import { useLessonState } from './useLessonState';
import { useChatStream } from './useChatStream';

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
    stepType?: string;
    script?: { transition?: string; content?: string; closure?: string };
    activity?: {
      instruction: string;
      options?: Array<{ text: string; isCorrect: boolean }>;
    };
  };
}

interface StartRecipeResult {
  sessionId: string;
  voiceText?: string;
  needsStart?: boolean;
}

let _voiceSettings: VoiceSettings = {};

export function useVoiceSettingsSync(settings: VoiceSettings): void {
  useEffect(() => {
    _voiceSettings = settings;
  }, [settings]);
}

export function useClassOrchestrator() {
  const { setSessionId, setCurrentState, setIsSpeaking: syncStore, setError } = useLessonStore();
  const {
    setStreamingChunks,
    setIsStreaming: setStoreStreaming,
    setStreamError,
    clearStream,
  } = useLessonStore();
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
  } = useLessonState();

  const [transitionText, setTransitionText] = useState('');
  const [closureText, setClosureText] = useState('');
  const [fullVoiceText, setFullVoiceText] = useState('');

  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isMountedRef = useRef(true);
  const streamingChunksRef = useRef<string[]>([]);
  const chunkHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const endHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const errorHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);

  useEffect(() => {
    syncStore(isSpeaking);
  }, [isSpeaking, syncStore]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (eventSourceRef.current) {
      const es = eventSourceRef.current;
      if (chunkHandlerRef.current) es.removeEventListener('chunk', chunkHandlerRef.current);
      if (endHandlerRef.current) es.removeEventListener('end', endHandlerRef.current);
      if (errorHandlerRef.current) es.removeEventListener('error', errorHandlerRef.current);
      es.close();
      eventSourceRef.current = null;
      chunkHandlerRef.current = null;
      endHandlerRef.current = null;
      errorHandlerRef.current = null;
    }
    stopStream();
  }, [stopStream]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

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
    } = raw;

    if (lessonProgress) {
      setCurrentStep(lessonProgress.currentStep);
      setTotalSteps(lessonProgress.totalSteps);
    }
    setCurrentState(pedagogicalState);

    if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
      setUIState('completed');
      speak(voiceText || '¡Lo lograste!', _voiceSettings).catch(() => {});
      return;
    }

    if (pedagogicalState === 'EVALUATION') {
      const msg = feedback || (isCorrect ? '¡Bien hecho!' : 'Casi, ¡sigue intentando!');
      setFeedbackData({ isCorrect: !!isCorrect, message: msg });
      setUIState('feedback');

      const startTime = Date.now();
      await speak(voiceText || msg, _voiceSettings);
      const elapsed = Date.now() - startTime;
      const totalDuration = FEEDBACK_DISPLAY_MS + estimateReadTime(msg);
      const remaining = Math.max(0, totalDuration - elapsed);

      timerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsProcessing(true);
        doInteractRef
          .current('continuar')
          .then(processResponse)
          .finally(() => setIsProcessing(false));
      }, remaining);
      return;
    }

    const activity = staticContent?.activity;
    const hasOptions = Array.isArray(activity?.options) && activity.options.length > 0;

    if (pedagogicalState === 'ACTIVITY_WAIT') {
      setQuestionText(activity?.instruction || '');
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
      speak(voiceText || activity?.instruction || '', _voiceSettings).catch(() => {});
      return;
    }

    if (staticContent?.script) {
      setTransitionText(staticContent.script.transition || '');
      setContentText(staticContent.script.content || '');
      setClosureText(staticContent.script.closure || '');
      setFullVoiceText(voiceText);
      contentRef.current = voiceText;
    } else {
      setTransitionText('');
      setContentText(voiceText);
      setClosureText('');
      setFullVoiceText(voiceText);
      contentRef.current = voiceText;
    }

    setFeedbackData(null);
    setUIState('concentration');

    const startTime = Date.now();
    await speak(voiceText, _voiceSettings);
    const elapsed = Date.now() - startTime;
    const totalDuration = estimateReadTime(voiceText);
    const remaining = Math.max(0, totalDuration - elapsed);

    timerRef.current = setTimeout(() => {
      if (!sessionIdRef.current || !isMountedRef.current) return;
      setIsProcessing(true);
      doInteractRef
        .current('continuar')
        .then(processResponse)
        .finally(() => setIsProcessing(false));
    }, remaining);
  }

  const doInteractRef = useRef<(input: string) => Promise<LessonResponse>>(() => {
    throw new Error('doInteract not initialized');
  });

  const processResponseRef = useRef<(raw: LessonResponse) => Promise<void>>(() =>
    Promise.resolve(),
  );
  processResponseRef.current = processResponse;

  const doInteract = useCallback(
    async (input: string): Promise<LessonResponse> => {
      const sid = sessionIdRef.current;
      if (!sid) throw new Error('No session active');

      if (import.meta.env.VITE_ENABLE_STREAMING === 'true') {
        try {
          abortControllerRef.current = new AbortController();
          const eventSource = streamInteractWithRecipe(sid, input);
          eventSourceRef.current = eventSource;

          let fullText = '';
          setStoreStreaming(true);
          setStreamError(null);
          clearStream();

          chunkHandlerRef.current = (e: MessageEvent) => {
            if (!isMountedRef.current) return;
            try {
              const { text } = JSON.parse(e.data) as { text: string };
              fullText += text;
              streamingChunksRef.current = [...streamingChunksRef.current, text];
              setStreamingChunks(streamingChunksRef.current);
              setContentText((prev) => prev + text);
            } catch {}
          };

          endHandlerRef.current = (e: MessageEvent) => {
            if (!isMountedRef.current) return;
            setStoreStreaming(false);
            if (eventSourceRef.current) {
              eventSourceRef.current.removeEventListener('chunk', chunkHandlerRef.current!);
              eventSourceRef.current.removeEventListener('end', endHandlerRef.current!);
              eventSourceRef.current.removeEventListener('error', errorHandlerRef.current!);
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            chunkHandlerRef.current = null;
            endHandlerRef.current = null;
            errorHandlerRef.current = null;
            try {
              const { pedagogicalState, sessionCompleted, lessonProgress } = JSON.parse(e.data) as {
                pedagogicalState: PedagogicalState;
                sessionCompleted: boolean;
                lessonProgress?: { currentStep: number; totalSteps: number };
              };
              const syntheticResponse: LessonResponse = {
                voiceText: fullText,
                pedagogicalState,
                sessionCompleted,
                lessonProgress,
              };
              processResponseRef.current?.(syntheticResponse);
            } catch {
              api.interactWithRecipe(sid, input).then(processResponse);
            }
          };

          errorHandlerRef.current = (e: MessageEvent) => {
            if (!isMountedRef.current) return;
            setStoreStreaming(false);
            try {
              const { message } = JSON.parse(e.data) as { message: string };
              setStreamError(message);
            } catch {
              setStreamError('Stream error');
            }
            if (eventSourceRef.current) {
              eventSourceRef.current.removeEventListener('chunk', chunkHandlerRef.current!);
              eventSourceRef.current.removeEventListener('end', endHandlerRef.current!);
              eventSourceRef.current.removeEventListener('error', errorHandlerRef.current!);
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            chunkHandlerRef.current = null;
            endHandlerRef.current = null;
            errorHandlerRef.current = null;
            api.interactWithRecipe(sid, input).then(processResponse);
          };

          eventSource.addEventListener('chunk', chunkHandlerRef.current);
          eventSource.addEventListener('end', endHandlerRef.current);
          eventSource.addEventListener('error', errorHandlerRef.current);

          eventSource.onerror = () => {
            if (!isMountedRef.current) return;
            setStoreStreaming(false);
            setStreamError('Connection error');
            if (eventSourceRef.current) {
              if (chunkHandlerRef.current)
                eventSourceRef.current.removeEventListener('chunk', chunkHandlerRef.current);
              if (endHandlerRef.current)
                eventSourceRef.current.removeEventListener('end', endHandlerRef.current);
              if (errorHandlerRef.current)
                eventSourceRef.current.removeEventListener('error', errorHandlerRef.current);
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            chunkHandlerRef.current = null;
            endHandlerRef.current = null;
            errorHandlerRef.current = null;
            api.interactWithRecipe(sid, input).then(processResponse);
          };

          return {} as LessonResponse;
        } catch (e: unknown) {
          if (e instanceof Error && e.message === 'Streaming disabled') {
          } else {
            return (await api.interactWithRecipe(sid, input)) as LessonResponse;
          }
        }
      }

      return (await api.interactWithRecipe(sid, input)) as LessonResponse;
    },
    [
      clearStream,
      processResponse,
      setContentText,
      setStreamError,
      setStoreStreaming,
      setStreamingChunks,
    ],
  );

  doInteractRef.current = doInteract;

  const startClass = useCallback(
    async (lessonId: string): Promise<Result<void, Error>> => {
      cleanup();
      abortControllerRef.current = new AbortController();
      setIsProcessing(true);

      try {
        const startResult = (await api.startRecipe(lessonId)) as StartRecipeResult;
        sessionIdRef.current = startResult.sessionId;
        setSessionId(startResult.sessionId);

        if (!isMountedRef.current) return Ok(undefined);

        speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch(() => {});

        const firstStep = await doInteract('comenzar');
        processResponse(firstStep);

        return Ok(undefined);
      } catch (e) {
        if (isMountedRef.current) setIsProcessing(false);
        return Err(e instanceof Error ? e : new Error('Failed to start lesson'));
      }
    },
    [cleanup, setSessionId, speak, doInteract, processResponse, setIsProcessing],
  );

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!sessionIdRef.current || isProcessing) return;
      setIsProcessing(true);
      try {
        const res = await doInteract(answer);
        processResponse(res);
      } finally {
        if (isMountedRef.current) setIsProcessing(false);
      }
    },
    [isProcessing, doInteract, processResponse, setIsProcessing],
  );

  const reset = useCallback(() => {
    cleanup();
    sessionIdRef.current = null;
    contentRef.current = '';
    resetState();
    setSessionId(null);
    setCurrentState('AWAITING_START');
    setError(null);
    clearStream();
  }, [cleanup, resetState, setSessionId, setCurrentState, setError, clearStream]);

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
    startClass,
    submitAnswer,
    speakContent: () =>
      contentRef.current && speak(contentRef.current, _voiceSettings).catch(() => {}),
    stopSpeaking: voiceStop,
    reset,
    getCurrentAudioElement: getAudio,
  };
}
