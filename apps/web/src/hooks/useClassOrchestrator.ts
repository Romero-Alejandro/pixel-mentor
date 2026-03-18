/**
 * useClassOrchestrator.ts
 *
 * Orquestador centralizado de la clase virtual.
 *
 * Maneja 3 tipos de paso que requieren interacción del alumno:
 *   - `question`  → pregunta de comprensión (input libre, sin opciones)
 *   - `activity`  → actividad MCQ (opciones de opción múltiple)
 *   - `exam`      → examen MCQ (igual que activity, marcado distinto)
 *
 * Y 3 tipos que avanzan automáticamente:
 *   - `content`   → explicación con ejemplos
 *   - `intro`     → introducción
 *   - `closure`   → cierre
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import { api } from '@/services/api';
import { useVoice, VoiceSettings } from '@/hooks/useVoice';
import { useLessonStore } from '@/stores/lessonStore';

// ─── Result type for error handling ────────────────────────────────────────────

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type UIState =
  | 'idle' // Pantalla de inicio
  | 'concentration' // Mostrando contenido (auto-avance)
  | 'question' // Pregunta de comprensión (input libre)
  | 'activity' // Actividad MCQ (opciones)
  | 'feedback' // Mostrando retroalimentación
  | 'completed'; // Clase finalizada

export type { VoiceSettings } from '@/hooks/useVoice';

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

export interface ClassOrchestrator {
  uiState: UIState;
  currentStep: number;
  totalSteps: number;
  contentText: string;
  questionText: string;
  options: Option[]; // Vacío en preguntas de comprensión
  feedback: FeedbackData | null;
  isProcessing: boolean;
  isSpeaking: boolean;
  startClass: (lessonId: string) => Promise<Result<void, Error>>;
  submitAnswer: (answer: string) => Promise<void>;
  speakContent: () => void;
  stopSpeaking: () => void;
  reset: () => void;
  getCurrentAudioElement: () => HTMLAudioElement | null;
}

// ─── Tiempos de auto-avance ───────────────────────────────────────────────────

const WORDS_PER_SECOND = 2.5;
const MIN_DISPLAY_MS = 3_000;
const POST_SPEECH_BUFFER_MS = 1_200;
const FEEDBACK_DISPLAY_MS = 2_800;
const GREETING_PAUSE_MS = 1_200;

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(MIN_DISPLAY_MS, (words / WORDS_PER_SECOND) * 1_000 + POST_SPEECH_BUFFER_MS);
}

// ─── Settings de voz globales ─────────────────────────────────────────────────

let _voiceSettings: VoiceSettings = {};

export function useVoiceSettingsSync(settings: VoiceSettings): void {
  useEffect(() => {
    _voiceSettings = settings;
  });
}

// ─── Frases de aliento ────────────────────────────────────────────────────────

const ENCOURAGEMENTS = ['¡Excelente!', '¡Lo lograste!', '¡Así se hace!', '¡Genial!', '¡Muy bien!'];
const randomEncouragement = () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────

export function useClassOrchestrator(): ClassOrchestrator {
  const { setSessionId, setCurrentState, setIsSpeaking: syncStore, setError } = useLessonStore();
  const {
    speak,
    stopSpeaking: voiceStop,
    isSpeaking,
    getCurrentAudioElement: getAudio,
  } = useVoice();

  const [uiState, setUIState] = useState<UIState>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [contentText, setContentText] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');
  const processRef = useRef<(r: unknown) => void>(() => {});
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    syncStore(isSpeaking);
  }, [isSpeaking, syncStore]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup function for cancellation
  const cleanup = useCallback(() => {
    clearTimer();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const doInteract = useCallback(async (input: string): Promise<unknown> => {
    const sid = sessionIdRef.current;
    if (!sid) throw new Error('No session');
    // Check if aborted before making request
    if (abortControllerRef.current?.signal.aborted) {
      throw new Error('Operation cancelled');
    }
    return api.interactWithRecipe(sid, input);
  }, []);

  // ─── Función central de procesamiento de respuestas ───────────────────────
  const processResponse = useCallback(
    (raw: unknown) => {
      const r = raw as {
        voiceText?: string;
        pedagogicalState?: string;
        staticContent?: {
          stepType?: string;
          script?: { content?: string; transition?: string };
          activity?: {
            instruction: string;
            options?: Array<{ text: string; isCorrect: boolean }>;
            feedback?: { correct: string; incorrect: string; partial?: string };
          };
        };
        isCorrect?: boolean | null;
        feedback?: string;
        sessionCompleted?: boolean;
        lessonProgress?: { currentStep: number; totalSteps: number };
      };

      const {
        voiceText = '',
        pedagogicalState = 'EXPLANATION',
        staticContent,
        isCorrect,
        feedback,
        sessionCompleted,
        lessonProgress,
      } = r;

      if (lessonProgress) {
        setCurrentStep(lessonProgress.currentStep);
        setTotalSteps(lessonProgress.totalSteps);
      }
      setCurrentState(pedagogicalState as never);

      // ── COMPLETADO ───────────────────────────────────────────────────────
      if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
        clearTimer();
        setUIState('completed');
        speak(voiceText || '¡Felicitaciones!', _voiceSettings).catch(() => {});
        return;
      }

      // ── EVALUACIÓN / FEEDBACK ────────────────────────────────────────────
      if (pedagogicalState === 'EVALUATION') {
        const msg = feedback || (isCorrect ? '¡Correcto!' : 'No es correcto, seguí intentando.');
        setFeedbackData({
          isCorrect: !!isCorrect,
          message: msg,
          encouragement: isCorrect ? randomEncouragement() : undefined,
        });
        setUIState('feedback');
        clearTimer();
        speak(voiceText || msg, _voiceSettings).catch(() => {});

        // Auto-avance post-feedback
        const delay = FEEDBACK_DISPLAY_MS + estimateReadTime(voiceText || msg);
        timerRef.current = setTimeout(() => {
          if (!sessionIdRef.current) return;
          setIsProcessing(true);
          doInteract('continuar')
            .then((r) => processRef.current(r))
            .catch((err) => console.error('[Orchestrator] post-feedback:', err))
            .finally(() => setIsProcessing(false));
        }, delay);
        return;
      }

      const stepType = staticContent?.stepType;
      const activity = staticContent?.activity;
      const hasOptions = Array.isArray(activity?.options) && activity!.options.length > 0;

      // ── PREGUNTA DE COMPRENSIÓN (input libre, sin opciones) ──────────────
      if (
        pedagogicalState === 'ACTIVITY_WAIT' &&
        stepType === 'activity' &&
        activity &&
        !hasOptions
      ) {
        setQuestionText(activity.instruction);
        setOptions([]); // Sin opciones = input de texto libre
        setFeedbackData(null);
        setUIState('question');
        clearTimer();
        speak(voiceText || activity.instruction, _voiceSettings).catch(() => {});
        return;
      }

      // ── ACTIVIDAD / EXAMEN MCQ (con opciones) ────────────────────────────
      if (pedagogicalState === 'ACTIVITY_WAIT' && stepType === 'activity' && hasOptions) {
        const parsedOptions: Option[] = activity!.options!.map((o, i) => ({
          id: `opt-${i}`,
          text: o.text,
          isCorrect: o.isCorrect,
        }));
        setQuestionText(activity!.instruction);
        setOptions(parsedOptions);
        setFeedbackData(null);
        setUIState('activity');
        clearTimer();
        speak(voiceText || activity!.instruction, _voiceSettings).catch(() => {});
        return;
      }

      // ── CONCENTRACIÓN (contenido / intro / closure) ──────────────────────
      const display = staticContent?.script?.content || voiceText || '';
      setContentText(display);
      contentRef.current = display;
      setFeedbackData(null);
      setUIState('concentration');

      speak(voiceText, _voiceSettings).catch(() => {});
      clearTimer();
      timerRef.current = setTimeout(
        () => {
          if (!sessionIdRef.current) return;
          setIsProcessing(true);
          doInteract('continuar')
            .then((r) => processRef.current(r))
            .catch((err) => console.error('[Orchestrator] auto-avance:', err))
            .finally(() => setIsProcessing(false));
        },
        estimateReadTime(voiceText || display),
      );
    },
    [clearTimer, speak, doInteract, setCurrentState],
  );

  useEffect(() => {
    processRef.current = processResponse;
  });

  // ─── startClass ───────────────────────────────────────────────────────────
  const startClass = useCallback(
    async (lessonId: string): Promise<Result<void, Error>> => {
      console.log('[Orchestrator] startClass called with lessonId:', lessonId);
      // Cancel any previous session
      cleanup();
      abortControllerRef.current = new AbortController();

      setIsProcessing(true);
      setUIState('idle');
      setFeedbackData(null);
      setContentText('');
      setOptions([]);

      try {
        console.log('[Orchestrator] Calling api.startRecipe...');
        const startResult = (await api.startRecipe(lessonId)) as any;
        console.log('[Orchestrator] startRecipe success:', startResult);

        // Handle post-API success scenarios intelligently
        // Even if component unmounted or aborted, the session was created successfully on backend
        if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
          console.warn('[Orchestrator] Component unmounted or aborted after API success');
          console.warn(
            '[Orchestrator] Session was created successfully on backend, continuing anyway',
          );
          // We still need to set sessionId to allow recovery/resumption
          sessionIdRef.current = startResult.sessionId;
          setSessionId(startResult.sessionId);
          console.log('[Orchestrator] Session created (post-unmount):', startResult.sessionId);

          // CRITICAL: If needsStart is true, we must call doInteract('comenzar') even if unmounting
          // Otherwise the class remains in AWAITING_START and never advances
          if (startResult.needsStart) {
            console.log(
              '[Orchestrator] Component unmounted but needsStart=true - initiating class immediately',
            );
            doInteract('comenzar')
              .then((firstStep) => {
                console.log('[Orchestrator] doInteract succeeded (unmounted):', firstStep);
                processRef.current(firstStep);
              })
              .catch((err) => {
                console.error('[Orchestrator] doInteract failed after unmount:', err);
                // We can't update UI state since component is unmounted, but at least backend advances
              });
          }
          // Don't speak or set timers if unmounted, but return success
        }

        // Continue normal flow only if still mounted
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          sessionIdRef.current = startResult.sessionId;
          setSessionId(startResult.sessionId);
          console.log('[Orchestrator] Session created:', startResult.sessionId);

          console.log('[Orchestrator] Speaking greeting:', startResult.voiceText);
          speak(startResult.voiceText || '¡Bienvenido!', _voiceSettings).catch((err) => {
            console.error('[Orchestrator] speak failed:', err);
          });

          const delay =
            GREETING_PAUSE_MS + estimateReadTime(startResult.voiceText || '¡Bienvenido!');
          timerRef.current = setTimeout(async () => {
            if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
              console.log('[Orchestrator] Timer fired but component unmounted/aborted');
              return;
            }

            try {
              console.log('[Orchestrator] Timer completed, calling doInteract("comenzar")');
              const firstStep = await doInteract('comenzar');
              console.log('[Orchestrator] First step received:', firstStep);
              processRef.current(firstStep);
            } catch (e) {
              console.error('[Orchestrator] startClass error after timer:', e);
              // Propagate error to UI
              if (isMountedRef.current) {
                setError('Error al cargar la clase. Por favor, intenta de nuevo.');
              }
            } finally {
              if (isMountedRef.current) {
                setIsProcessing(false);
              }
            }
          }, delay);
        }

        return Ok(undefined);
      } catch (e) {
        console.error('[Orchestrator] startRecipe error details:', e);
        setIsProcessing(false);
        return Err(e instanceof Error ? e : new Error('Failed to start class'));
      }
    },
    [cleanup, setSessionId, speak, doInteract],
  );

  // ─── submitAnswer ─────────────────────────────────────────────────────────
  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!sessionIdRef.current || isProcessing) return;
      clearTimer();
      setIsProcessing(true);
      try {
        const r = await doInteract(answer);
        processRef.current(r);
      } catch (e) {
        console.error('[Orchestrator] submitAnswer error:', e);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, clearTimer, doInteract],
  );

  const speakContent = useCallback(() => {
    if (contentRef.current) speak(contentRef.current, _voiceSettings).catch(() => {});
  }, [speak]);

  const stopSpeaking = useCallback(() => {
    voiceStop();
    clearTimer();
  }, [voiceStop, clearTimer]);

  const reset = useCallback(() => {
    cleanup();
    sessionIdRef.current = null;
    contentRef.current = '';
    setUIState('idle');
    setCurrentStep(0);
    setTotalSteps(0);
    setContentText('');
    setQuestionText('');
    setOptions([]);
    setFeedbackData(null);
    setIsProcessing(false);
    setSessionId(null);
    setCurrentState('AWAITING_START');
    setError(null);
  }, [cleanup, setSessionId, setCurrentState]);

  return {
    uiState,
    currentStep,
    totalSteps,
    contentText,
    questionText,
    options,
    feedback: feedbackData,
    isProcessing,
    isSpeaking,
    startClass,
    submitAnswer,
    speakContent,
    stopSpeaking,
    reset,
    getCurrentAudioElement: getAudio,
  };
}
