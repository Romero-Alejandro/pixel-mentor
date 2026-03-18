import { useCallback, useEffect, useRef } from 'react';

import { estimateReadTime } from '../utils/readTimeEstimator';

import { useLessonState } from './useLessonState';

import { api, type PedagogicalState } from '@/services/api';
import { useVoice, type VoiceSettings } from '@/hooks/useVoice';
import { useLessonStore } from '@/stores/lessonStore';

// --- Tipos de Resultado ---
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// --- Interfaces de API ---
interface LessonResponse {
  voiceText?: string;
  pedagogicalState?: PedagogicalState;
  isCorrect?: boolean | null;
  feedback?: string;
  sessionCompleted?: boolean;
  lessonProgress?: { currentStep: number; totalSteps: number };
  staticContent?: {
    stepType?: string;
    script?: { content?: string };
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

const FEEDBACK_DISPLAY_MS = 2800;
let _voiceSettings: VoiceSettings = {};

export function useVoiceSettingsSync(settings: VoiceSettings): void {
  useEffect(() => {
    _voiceSettings = settings;
  }, [settings]);
}

export function useClassOrchestrator() {
  const { setSessionId, setCurrentState, setIsSpeaking: syncStore, setError } = useLessonStore();
  const {
    speak,
    stopSpeaking: voiceStop,
    isSpeaking,
    getCurrentAudioElement: getAudio,
  } = useVoice();

  // Desestructuramos para tener referencias estables de las funciones de estado
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

  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    syncStore(isSpeaking);
  }, [isSpeaking, syncStore]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const doInteract = useCallback(async (input: string): Promise<LessonResponse> => {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error('No session active');
    return api.interactWithRecipe(sid, input) as Promise<LessonResponse>;
  }, []);

  // --- Procesamiento de Respuestas (Lógica Central) ---
  const processResponse = useCallback(
    (raw: LessonResponse) => {
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

      // 1. Actualizar Progreso
      if (lessonProgress) {
        setCurrentStep(lessonProgress.currentStep);
        setTotalSteps(lessonProgress.totalSteps);
      }
      setCurrentState(pedagogicalState);

      // 2. Caso: Fin de Clase
      if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
        setUIState('completed');
        speak(voiceText || '¡Lo lograste!', _voiceSettings).catch(() => {});
        return;
      }

      // 3. Caso: Feedback de pregunta/actividad
      if (pedagogicalState === 'EVALUATION') {
        const msg = feedback || (isCorrect ? '¡Bien hecho!' : 'Casi, ¡sigue intentando!');
        setFeedbackData({
          isCorrect: !!isCorrect,
          message: msg,
        });
        setUIState('feedback');
        speak(voiceText || msg, _voiceSettings).catch(() => {});

        timerRef.current = setTimeout(
          () => {
            if (!isMountedRef.current) return;
            setIsProcessing(true);
            doInteract('continuar')
              .then(processResponse)
              .finally(() => setIsProcessing(false));
          },
          FEEDBACK_DISPLAY_MS + estimateReadTime(voiceText || msg),
        );
        return;
      }

      // 4. Caso: Espera de interacción (Pregunta o Actividad)
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

      // 5. Caso: Explicación (Avance automático)
      const display = staticContent?.script?.content || voiceText || '';
      setContentText(display);
      contentRef.current = display;
      setFeedbackData(null);
      setUIState('concentration');
      speak(voiceText, _voiceSettings).catch(() => {});

      timerRef.current = setTimeout(() => {
        if (!sessionIdRef.current || !isMountedRef.current) return;
        setIsProcessing(true);
        doInteract('continuar')
          .then(processResponse)
          .finally(() => setIsProcessing(false));
      }, estimateReadTime(display));
    },
    [
      setCurrentStep,
      setTotalSteps,
      setCurrentState,
      setUIState,
      speak,
      setFeedbackData,
      setQuestionText,
      setOptions,
      setContentText,
      setIsProcessing,
      doInteract,
    ],
  );

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

        // Iniciamos el flujo inmediatamente para obtener el primer contenido
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
  }, [cleanup, resetState, setSessionId, setCurrentState, setError]);

  return {
    // Estado
    uiState,
    currentStep,
    totalSteps,
    contentText,
    questionText,
    options,
    feedback: feedbackData, // Mapeo crítico para la UI
    isProcessing,
    isSpeaking,
    // Acciones
    startClass,
    submitAnswer,
    speakContent: () =>
      contentRef.current && speak(contentRef.current, _voiceSettings).catch(() => {}),
    stopSpeaking: voiceStop,
    reset,
    getCurrentAudioElement: getAudio,
  };
}
