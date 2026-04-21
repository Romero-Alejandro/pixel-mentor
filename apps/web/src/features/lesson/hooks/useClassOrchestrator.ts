import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EventSourceMessage } from '@microsoft/fetch-event-source';
import { useLessonState } from './useLessonState';
import { useChatStream } from './useChatStream';
import { api, streamInteractWithRecipe, type PedagogicalState } from '@/services/api';
import { useVoice, type VoiceSettings } from '@/features/voice/hooks/useVoice';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

interface LessonResponse {
  voiceText?: string;
  pedagogicalState?: PedagogicalState;
  isCorrect?: boolean | null;
  feedback?: string;
  sessionCompleted?: boolean;
  lessonProgress?: { currentStep: number; totalSteps: number };
  staticContent?: {
    stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
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
  accuracy?: any;
}

let _voiceSettings: VoiceSettings = {};

export function useVoiceSettingsSync(settings: VoiceSettings): void {
  useEffect(() => {
    _voiceSettings = settings;
  }, [settings]);
}

// Helper seguro para extraer texto de las respuestas anidadas de la IA
const extractText = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'text' in val)
    return String((val as { text: unknown }).text);
  return '';
};

export function useClassOrchestrator() {
  const store = useLessonStore(
    useShallow((state) => ({
      setSessionId: state.setSessionId,
      setCurrentState: state.setCurrentState,
      setIsSpeaking: state.setIsSpeaking,
      setError: state.setError,
      setIsStreaming: state.setIsStreaming,
      setStreamError: state.setStreamError,
      clearStream: state.clearStream,
      setIsRepeat: state.setIsRepeat,
      setXpEarned: state.setXpEarned,
      setAccuracy: state.setAccuracy,
      isStreaming: state.isStreaming,
      reset: state.reset,
    })),
  );

  const { stopStream } = useChatStream();
  const {
    speak,
    stopSpeaking: voiceStop,
    isSpeaking,
    getCurrentAudioElement: getAudio,
  } = useVoice();
  const lessonState = useLessonState();

  const [transitionText, setTransitionText] = useState('');
  const [closureText, setClosureText] = useState('');
  const [fullVoiceText, setFullVoiceText] = useState('');

  const sessionIdRef = useRef<string | null>(null);
  const lessonIdRef = useRef<string | null>(null);
  const contentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInteractingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isInteractingRef.current = false;
    stopStream();
    voiceStop();
  }, [stopStream, voiceStop]);

  useEffect(() => {
    store.setIsSpeaking(isSpeaking);
  }, [isSpeaking, store]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const doInteract = useCallback(
    async (input: string, retries = 3): Promise<LessonResponse | null> => {
      if (isInteractingRef.current) return null; // Evitar colisiones

      const sid = sessionIdRef.current;
      if (!sid) throw new Error('Sesión no activa');

      isInteractingRef.current = true;

      try {
        if (import.meta.env.VITE_ENABLE_STREAMING === 'true') {
          let fullText = '';
          store.setIsStreaming(true);
          store.setStreamError(null);
          store.clearStream();
          lessonState.setContentText('');

          return await new Promise<LessonResponse>((resolve, reject) => {
            let resolved = false;
            const fallbackState = {
              voiceText: '',
              pedagogicalState: 'EXPLANATION' as const,
              sessionCompleted: false,
              lessonProgress: { currentStep: 1, totalSteps: 10 },
            };
            const timeout = setTimeout(() => {
              if (!resolved) {
                console.warn('[DEBUG] Stream timeout, using fallback response');
                resolve(fallbackState);
              }
            }, 5000);

            const controller = streamInteractWithRecipe(sid, input, {
              onMessage: (event: EventSourceMessage) => {
                if (event.event === 'end') {
                  try {
                    clearTimeout(timeout);
                    resolved = true;
                    const data = JSON.parse(event.data);
                    resolve({ ...data, voiceText: fullText });
                  } catch (e) {
                    clearTimeout(timeout);
                    resolved = true;
                    reject(new Error('Error parsing stream end data'));
                  }
                } else if (event.event === 'chunk') {
                  try {
                    const data = JSON.parse(event.data);
                    fullText += data.text || '';
                    lessonState.setContentText(fullText);
                  } catch (e) {
                    // Ignorar chunks mal formados silenciosamente para no romper el stream
                  }
                }
              },
              onError: (err) => {
                clearTimeout(timeout);
                if (!resolved) reject(err);
              },
              onClose: () => {
                clearTimeout(timeout);
                if (!resolved) {
                  console.warn('[DEBUG] Stream closed before receiving end event, using fallback');
                  resolve(fallbackState);
                }
                isInteractingRef.current = false;
                store.setIsStreaming(false);
              },
            });
            abortControllerRef.current = controller;
          });
        }

        return (await api.interactWithRecipe(sid, input)) as LessonResponse;
      } catch (err: any) {
        if (retries > 0 && err?.message?.includes('429')) {
          await new Promise((r) => setTimeout(r, 1000));
          isInteractingRef.current = false; // Liberar lock antes de reintentar
          return doInteract(input, retries - 1);
        }
        throw err;
      } finally {
        isInteractingRef.current = false;
      }
    },
    [store, lessonState],
  );

  const processResponse = useCallback(
    async (raw: LessonResponse | null, isFirstCall = true): Promise<void> => {
      if (!raw) return;

      // Solo limpiar estado previo en la primera llamada (inicio de lección), no en auto-avance
      // Esto evita que datos de sesiones anteriores contaminen la nueva sesión
      if (isFirstCall) {
        lessonState.setContentText('');
        lessonState.setQuestionText('');
        lessonState.setOptions([]);
        lessonState.setFeedbackData(null);
      }

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
        lessonState.setCurrentStep(lessonProgress.currentStep);
        lessonState.setTotalSteps(lessonProgress.totalSteps);
      }

      store.setCurrentState(pedagogicalState);

      // --- 1. Estado Completado ---
      if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
        if (xpEarned !== undefined) store.setXpEarned(xpEarned);
        if (accuracy !== undefined) store.setAccuracy(accuracy);
        lessonState.setUIState('completed');
        await speak(voiceText || '¡Misión cumplida!', _voiceSettings);
        return;
      }

      // --- 2. Estado Evaluación (Feedback de respuesta) ---
      if (pedagogicalState === 'EVALUATION') {
        const msg = feedback || (isCorrect ? '¡Muy bien!' : '¡Sigue intentando!');
        lessonState.addQuestionResult(lessonState.questionText, !!isCorrect);
        lessonState.setFeedbackData({ isCorrect: !!isCorrect, message: msg });

        if (lessonState.uiState === 'activity') {
          await new Promise((r) => setTimeout(r, 2000)); // Pausa dramática para ver respuesta correcta
        }

        lessonState.setUIState('feedback');
        await speak(voiceText || msg, _voiceSettings);

        // Auto-avanzar después del feedback
        const next = await doInteract('__auto__');
        if (next) processResponse(next, false);
        return;
      }

      // --- 3. Estado Actividad ---
      if (pedagogicalState === 'ACTIVITY_WAIT') {
        const { stepType, activity } = staticContent || {};
        const hasOptions = activity?.options && activity.options.length > 0;
        console.log('[DEBUG] ACTIVITY_WAIT STATE:', {
          stepType,
          activity,
          hasOptions,
        });

        lessonState.setQuestionText(extractText(activity?.instruction));
        lessonState.setOptions(
          activity?.options?.map((o, i) => ({
            id: `opt-${i}`,
            text: o.text,
            isCorrect: o.isCorrect,
          })) || [],
        );
        lessonState.setFeedbackData(null);
        // Panel decision: ActivityPanel if stepType=activity OR (stepType=question with options)
        // Otherwise QuestionPanel
        const isActivityPanel = stepType === 'activity' || hasOptions;
        lessonState.setUIState(isActivityPanel ? 'activity' : 'question');
        await speak(voiceText || extractText(activity?.instruction) || '', _voiceSettings);
        return;
      }

      // --- 4. Estado Pregunta ---
      if (pedagogicalState === 'QUESTION') {
        const { stepType, script } = staticContent || {};
        const questionText = extractText(script?.question);
        console.log('[DEBUG] QUESTION STATE:', {
          pedagogicalState,
          stepType,
          questionText,
          staticContent: script,
        });

        // Always question panel for QUESTION pedagogical state (open-ended answers)
        lessonState.setQuestionText(questionText);
        lessonState.setOptions([]);
        lessonState.setFeedbackData(null);
        lessonState.setUIState('question');
        await speak(voiceText || questionText || '', _voiceSettings);
        return;
      }

      // --- 4. Estado Contenido (Explicación) ---
      // Solo mostrar contenido si NO es un estado que requiere input del usuario
      const statesRequiringInput = ['AWAITING_START', 'ACTIVITY_WAIT', 'QUESTION', 'EVALUATION'];
      if (!statesRequiringInput.includes(pedagogicalState)) {
        if (staticContent?.script) {
          setTransitionText(extractText(staticContent.script.transition));
          lessonState.setContentText(extractText(staticContent.script.content));
          setClosureText(extractText(staticContent.script.closure));
        } else {
          lessonState.setContentText(voiceText);
        }

        setFullVoiceText(voiceText);
        contentRef.current = voiceText;
        lessonState.setFeedbackData(null);
        console.log(
          '[DEBUG] Setting uiState to concentration, pedagogicalState:',
          pedagogicalState,
        );
        lessonState.setUIState('concentration');

        await speak(voiceText, _voiceSettings);
      } else {
        console.log(
          '[DEBUG] Skipping concentration state, pedagogicalState requires input:',
          pedagogicalState,
        );
        // Para estados que requieren input, no llamamos a speak aquí - el auto-avance lo manejará
      }

      // --- 5. Auto-avance condicional ---
      const needsUserInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'].includes(
        pedagogicalState,
      );
      const canAutoAdvance = !needsUserInput && !sessionCompleted;

      if (canAutoAdvance && voiceText.trim()) {
        if (isInteractingRef.current) {
          console.log(
            '[DEBUG] Waiting for previous interaction to complete before auto-advancing...',
          );
          let waitCount = 0;
          while (isInteractingRef.current && waitCount < 50) {
            await new Promise((r) => setTimeout(r, 100));
            waitCount++;
          }
        }
        const next = await doInteract('__auto__');
        if (next) await processResponse(next, false);
      } else if (pedagogicalState === 'AWAITING_START') {
        if (isInteractingRef.current) {
          console.log('[DEBUG] Waiting for previous interaction to complete before auto-start...');
          let waitCount = 0;
          while (isInteractingRef.current && waitCount < 50) {
            await new Promise((r) => setTimeout(r, 100));
            waitCount++;
          }
        }
        const next = await doInteract('listo');
        if (next) await processResponse(next, false);
      }
    },
    [store, lessonState, speak, doInteract],
  );

  const startClass = useCallback(
    async (lessonId: string): Promise<Result<void, Error>> => {
      cleanup();
      lessonState.setIsProcessing(true);
      lessonIdRef.current = lessonId;

      try {
        const classId = await api.getClassIdByLessonId(lessonId);
        if (!classId) {
          throw new Error('No se encontró la clase asociada a esta lección');
        }
        const result = await api.startClass(classId);
        sessionIdRef.current = result.sessionId;
        store.setSessionId(result.sessionId);
        store.setIsRepeat(!!result.isRepeat);

        await processResponse(result as LessonResponse, true);
        return { ok: true, value: undefined };
      } catch (e) {
        return { ok: false, error: e as Error };
      } finally {
        lessonState.setIsProcessing(false);
      }
    },
    [cleanup, lessonState, store, processResponse],
  );

  return {
    ...lessonState,
    transitionText,
    closureText,
    fullVoiceText,
    startClass,
    submitAnswer: async (ans: string) => {
      lessonState.setIsProcessing(true);
      try {
        const res = await doInteract(ans);
        if (res) await processResponse(res, false);
      } finally {
        lessonState.setIsProcessing(false);
      }
    },
    speakContent: () => contentRef.current && speak(contentRef.current, _voiceSettings),
    reset: async () => {
      // Detener todos los streams de audio primero
      voiceStop();
      stopStream();

      // Llamar al backend para reiniciar la sesión
      if (sessionIdRef.current) {
        try {
          await api.resetSession(sessionIdRef.current);
        } catch (error) {
          console.error('[LESSON_RESET] Backend reset failed:', error);
        }
      }

      // Cleanup completo
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // IMPORTANTE: Resetear el flag de interacción para permitir nuevas interacciones
      isInteractingRef.current = false;

      // Resetear store y state
      sessionIdRef.current = null;
      lessonState.resetState();
      // Forzar uiState a 'idle' explícitamente para mostrar la vista inicial correcta
      lessonState.setUIState('idle');
      store.reset();

      // Limpiar el estado local del orquestador que no está en el store
      setTransitionText('');
      setClosureText('');
      setFullVoiceText('');
      contentRef.current = '';
    },
    stopSpeaking: voiceStop,
    getCurrentAudioElement: getAudio,
  };
}
