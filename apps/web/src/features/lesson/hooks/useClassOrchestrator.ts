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
    script?: { transition?: string; content?: string; closure?: string };
    activity?: { instruction: string; options?: Array<{ text: string; isCorrect: boolean }> };
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
  const handlersRef = useRef({ chunk: null as any, end: null as any, error: null as any });

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
    } = raw;

    if (lessonProgress) {
      setCurrentStep(lessonProgress.currentStep);
      setTotalSteps(lessonProgress.totalSteps);
    }
    setCurrentState(pedagogicalState);

    if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
      setUIState('completed');
      speak(voiceText || '¡Misión cumplida!', _voiceSettings).catch(() => {});
      return;
    }

    if (pedagogicalState === 'EVALUATION') {
      const msg = feedback || (isCorrect ? '¡Muy bien!' : '¡Sigue intentando!');
      setFeedbackData({ isCorrect: !!isCorrect, message: msg });
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
    } else {
      setTransitionText('');
      setContentText(voiceText);
      setClosureText('');
    }

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
      try {
        abortControllerRef.current = new AbortController();
        const eventSource = streamInteractWithRecipe(sid, input);
        eventSourceRef.current = eventSource;

        let fullText = '';
        setStoreStreaming(true);
        setStreamError(null);
        clearStream();

        handlersRef.current.chunk = (e: MessageEvent) => {
          if (!isMountedRef.current) return;
          try {
            const { text } = JSON.parse(e.data);
            fullText += text;
            streamingChunksRef.current = [...streamingChunksRef.current, text];
            setStreamingChunks(streamingChunksRef.current);
            setContentText((prev) => prev + text);
          } catch {}
        };

        handlersRef.current.end = (e: MessageEvent) => {
          if (!isMountedRef.current) return;
          setStoreStreaming(false);
          cleanup();
          try {
            const parsed = JSON.parse(e.data);
            processResponse({ voiceText: fullText, ...parsed });
          } catch {
            api.interactWithRecipe(sid, input).then(processResponse);
          }
        };

        handlersRef.current.error = (e: MessageEvent) => {
          if (!isMountedRef.current) return;
          setStoreStreaming(false);
          cleanup();
          api.interactWithRecipe(sid, input).then(processResponse);
        };

        eventSource.addEventListener('chunk', handlersRef.current.chunk);
        eventSource.addEventListener('end', handlersRef.current.end);
        eventSource.addEventListener('error', handlersRef.current.error);
        eventSource.onerror = () => {
          if (!isMountedRef.current) return;
          setStoreStreaming(false);
          cleanup();
          api.interactWithRecipe(sid, input).then(processResponse);
        };

        return {} as LessonResponse;
      } catch {
        return (await api.interactWithRecipe(sid, input)) as LessonResponse;
      }
    }
    return (await api.interactWithRecipe(sid, input)) as LessonResponse;
  }

  async function startClass(lessonId: string): Promise<Result<void, Error>> {
    cleanup();
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);

    try {
      const startResult = await api.startRecipe(lessonId);
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
    startClass,
    submitAnswer,
    speakContent,
    stopSpeaking: voiceStop,
    reset,
    getCurrentAudioElement: getAudio,
  };
}
