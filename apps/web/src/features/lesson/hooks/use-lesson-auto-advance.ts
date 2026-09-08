/**
 * useLessonAutoAdvance
 *
 * Encapsulates:
 *   - Response processing (mapping API responses to UI state)
 *   - Auto-advance logic (navigating between steps)
 *   - Voice/text coordination for each pedagogical state
 *
 * Extracted from useClassOrchestrator to separate concerns.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LessonResponse } from './useLessonInteractions';
import { SSEError } from './useLessonInteractions';
import type { useLessonState as UseLessonStateFn } from './useLessonState';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';
import { type VoiceSettings } from '@/features/voice/hooks/useVoice';

// ---- Error Code → User Message mapping ----
const ERROR_MESSAGES: Record<string, string> = {
  SESSION_NOT_FOUND: 'No se encontro la sesion. Intenta de nuevo.',
  SESSION_NOT_ACTIVE: 'La sesion no esta activa. Recarga la pagina.',
  SESSION_ALREADY_COMPLETED: 'Esta leccion ya fue completada.',
  RECIPE_NOT_FOUND: 'No se encontro la leccion.',
  RECIPE_HAS_NO_STEPS: 'La leccion no tiene contenido.',
  ATOM_NOT_FOUND: 'Error en el contenido de la leccion.',
  LLM_TIMEOUT: 'El tutor esta tardando mucho. Intenta de nuevo.',
  LLM_CHUNK_TIMEOUT: 'La conexion con el tutor se interrumpio.',
  LLM_SERVICE_ERROR: 'El tutor no esta disponible temporalmente.',
  STREAMING_CONNECTION_ERROR: 'Se perdio la conexion. Reconectando...',
  STREAMING_DISABLED: 'El modo de streaming no esta disponible.',
  SESSION_LOCKED: 'La sesion esta siendo procesada. Espera un momento.',
  INVALID_INPUT: 'La entrada no es valida.',
  SESSION_ESCALATED: 'Sesion escalada a tutor humano.',
};

/** Get user-friendly message for an error */
function getErrorMessage(error: unknown): string {
  if (error instanceof SSEError && error.code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[error.code];
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit')) {
      return 'Demasiadas solicitudes. Espera un momento.';
    }
    if (msg.includes('timeout') || msg.includes('tardando')) {
      return 'La operacion tardo demasiado. Intenta de nuevo.';
    }
    if (msg.includes('conexion') || msg.includes('network') || msg.includes('fetch')) {
      return 'Error de conexion. Verifica tu internet.';
    }
  }
  return 'Ocurrio un error inesperado. Intenta de nuevo.';
}

// ---- Helpers ----

const extractText = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'text' in val)
    return String((val as { text: unknown }).text);
  return '';
};

// ---- Types ----

interface UseLessonAutoAdvanceParams {
  /** Call the backend to interact with the lesson */
  doInteract: (input: string) => Promise<LessonResponse | null>;
  /** Speak text using TTS */
  speak: (text: string, settings?: VoiceSettings) => Promise<boolean>;
  /** Voice settings to use for TTS */
  voiceSettings: VoiceSettings;
  /** Whether the interaction lock is held (for spin-wait) */
  isInteractingRef: React.MutableRefObject<boolean>;
  /**
   * Shared lesson UI state — single source of truth owned by
   * useClassOrchestrator. This hook must NOT create its own
   * useLessonState, otherwise progress updates never reach the UI.
   */
  lessonState: ReturnType<typeof UseLessonStateFn>;
}

// ---- Hook ----

export function useLessonAutoAdvance({
  doInteract,
  speak,
  voiceSettings,
  isInteractingRef,
  lessonState,
}: UseLessonAutoAdvanceParams) {
  const store = useLessonStore(
    useShallow((state) => ({
      setCurrentState: state.setCurrentState,
      setXpEarned: state.setXpEarned,
      setAccuracy: state.setAccuracy,
      setCurrentStep: state.setCurrentStep,
      setTotalSteps: state.setTotalSteps,
    })),
  );

  const [transitionText, setTransitionText] = useState('');
  const [closureText, setClosureText] = useState('');
  const [fullVoiceText, setFullVoiceText] = useState('');
  const contentRef = useRef('');

  // ── Refs to avoid stale closures in processResponse ──────────────────────
  // lessonState is a new object every render (from useState), so using it
  // directly in processResponse causes the recursive auto-advance chain to
  // capture stale state setters. Refs ensure we always call the latest.
  const lessonStateRef = useRef(lessonState);
  lessonStateRef.current = lessonState;
  const doInteractRef = useRef(doInteract);
  doInteractRef.current = doInteract;
  const speakRef = useRef(speak);
  speakRef.current = speak;
  const voiceSettingsRef = useRef(voiceSettings);
  voiceSettingsRef.current = voiceSettings;
  const storeRef = useRef(store);
  storeRef.current = store;

  // ── Generation token: cancels the processResponse→speak→autoAdvance chain ──
  // Every recursive auto-advance step captures the current generation and bails
  // out after each await when it no longer matches. cancelGeneration() bumps
  // the token so no stale step recreates speech or fetches after unmount/reset.
  const generationRef = useRef(0);
  const cancelGeneration = useCallback((): void => {
    generationRef.current += 1;
  }, []);

  // Bump on unmount so in-flight chains die with the component.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  // ---- Spin-wait helper ----

  const waitForLockRelease = useCallback(async () => {
    if (!isInteractingRef.current) return;
    let waitCount = 0;
    while (isInteractingRef.current && waitCount < 50) {
      await new Promise((r) => setTimeout(r, 100));
      waitCount++;
    }
  }, [isInteractingRef]);

  // ---- Process Response ----
  // NOTE: Uses refs for lessonState, doInteract, speak, voiceSettings, store
  // to avoid stale closures in the recursive auto-advance chain.
  // The deps array is kept minimal (only waitForLockRelease) to prevent
  // the function from being recreated on every render.

  const processResponse = useCallback(
    async (raw: LessonResponse | null, isFirstCall = true): Promise<void> => {
      if (!raw) return;
      const generation = generationRef.current;
      const isStale = (): boolean => generation !== generationRef.current;

      const ls = lessonStateRef.current;
      const di = doInteractRef.current;
      const spk = speakRef.current;
      const vs = voiceSettingsRef.current;
      const st = storeRef.current;

      // Resume is step-level, not a fresh start: hydrate progress from the
      // indicated step instead of wiping UI state with isFirstCall. The resume
      // greeting is spoken, never synced as lesson text (no intra-chunk offset
      // is restored — playback restarts at the step boundary).
      const isResumed = raw.resumed === true;

      // Only clear previous state on first call (lesson start), not on auto-advance
      if (isFirstCall && !isResumed) {
        ls.setContentText('');
        ls.setQuestionText('');
        ls.setOptions([]);
        ls.setFeedbackData(null);
      }

      const {
        voiceText = '',
        pedagogicalState = 'EXPLANATION',
        resolvedStaticContent: rawStaticContent,
        staticContent,
        contentSteps,
        isCorrect,
        feedback,
        sessionCompleted,
        lessonProgress,
        xpEarned,
        accuracy,
      } = raw;

      // Support resolvedStaticContent, staticContent (backend), and contentSteps
      const resolvedStaticContent = rawStaticContent || staticContent || contentSteps;

      if (lessonProgress) {
        ls.setCurrentStep(lessonProgress.currentStep);
        ls.setTotalSteps(lessonProgress.totalSteps);
        // Mirror progress into the persisted store for step-level resume.
        st.setCurrentStep(lessonProgress.currentStep);
        st.setTotalSteps(lessonProgress.totalSteps);
      }

      st.setCurrentState(pedagogicalState);

      // --- 1. Completed State ---
      if (pedagogicalState === 'COMPLETED' || sessionCompleted) {
        if (xpEarned !== undefined) st.setXpEarned(xpEarned);
        if (accuracy !== undefined) st.setAccuracy(accuracy);
        ls.setUIState('completed');
        await spk(voiceText || 'Mision cumplida!', vs);
        if (isStale()) return;
        return;
      }

      // --- 2. Evaluation State (Feedback) ---
      if (pedagogicalState === 'EVALUATION') {
        const msg = feedback || (isCorrect ? 'Muy bien!' : 'Sigue intentando!');
        ls.addQuestionResult(ls.questionText, !!isCorrect);
        ls.setFeedbackData({ isCorrect: !!isCorrect, message: msg });

        if (ls.uiState === 'activity') {
          await new Promise((r) => setTimeout(r, 2000)); // Dramatic pause
          if (isStale()) return;
        }

        ls.setUIState('feedback');
        await spk(voiceText || msg, vs);
        if (isStale()) return;

        // Auto-advance after feedback
        const next = await di('__auto__');
        if (isStale()) return;
        if (next) await processResponse(next, false);
        return;
      }

      // --- 3. Activity State ---
      if (pedagogicalState === 'ACTIVITY_WAIT') {
        const { stepType, activity } = resolvedStaticContent || {};
        const hasOptions = activity?.options && activity.options.length > 0;

        ls.setQuestionText(extractText(activity?.instruction));
        ls.setOptions(
          activity?.options?.map((o, i) => ({
            id: `opt-${i}`,
            text: o.text,
            isCorrect: o.isCorrect,
          })) || [],
        );
        ls.setFeedbackData(null);
        const isActivityPanel = stepType === 'activity' || hasOptions;
        ls.setUIState(isActivityPanel ? 'activity' : 'question');
        await spk(voiceText || extractText(activity?.instruction) || '', vs);
        if (isStale()) return;
        return;
      }

      // --- 4. Question State ---
      if (pedagogicalState === 'QUESTION') {
        const { script } = resolvedStaticContent || {};
        const questionText = extractText(script?.question);

        ls.setQuestionText(questionText);
        ls.setOptions([]);
        ls.setFeedbackData(null);
        ls.setUIState('question');
        await spk(voiceText || questionText || '', vs);
        if (isStale()) return;
        return;
      }

      // --- 5. Content/Explanation State ---
      const statesRequiringInput = ['AWAITING_START', 'ACTIVITY_WAIT', 'QUESTION', 'EVALUATION'];
      if (!statesRequiringInput.includes(pedagogicalState)) {
        let transition = '';
        let content = '';
        let closure = '';

        if (resolvedStaticContent?.script) {
          transition = extractText(resolvedStaticContent.script.transition) || '';
          const scriptContent = extractText(resolvedStaticContent.script.content) || '';
          closure = extractText(resolvedStaticContent.script.closure) || '';

          content = scriptContent.trim() || voiceText || '';
        } else {
          content = voiceText || '';
        }

        transition = transition || '';
        content = content || '';
        closure = closure || '';

        setTransitionText(transition);
        ls.setContentText(content);
        setClosureText(closure);

        const combinedText = [transition, content, closure].filter(Boolean).join(' ');

        ls.setFeedbackData(null);
        ls.setUIState('concentration');

        if (isResumed && !resolvedStaticContent?.script) {
          // Resume greeting without step content: speak it, but do not sync it
          // as lesson text (no contentRef/fullVoiceText) — resume restores the
          // step, not an intra-chunk playback offset.
          await spk(combinedText, vs);
        } else {
          setFullVoiceText(combinedText);
          contentRef.current = combinedText;
          await spk(combinedText, vs);
        }
        if (isStale()) return;
      }

      // --- 6. Auto-advance ---
      const needsUserInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'].includes(
        pedagogicalState,
      );
      const canAutoAdvance = !needsUserInput && !sessionCompleted;

      if (canAutoAdvance && voiceText.trim()) {
        await waitForLockRelease();
        if (isStale()) return;
        const next = await di('__auto__');
        if (isStale()) return;
        if (next) await processResponse(next, false);
      } else if (pedagogicalState === 'AWAITING_START') {
        await waitForLockRelease();
        if (isStale()) return;
        const next = await di('listo');
        if (isStale()) return;
        if (next) await processResponse(next, false);
      }
    },
    [waitForLockRelease],
  );

  // ---- Reset Texts ----
  // Clears the spoken-text state so a restart never flashes the previous
  // lesson's text while the new session loads.

  const resetTexts = useCallback(() => {
    setTransitionText('');
    setClosureText('');
    setFullVoiceText('');
    contentRef.current = '';
  }, []);

  // ---- Public API ----

  return {
    processResponse,
    cancelGeneration,
    transitionText,
    closureText,
    fullVoiceText,
    contentRef,
    getErrorMessage,
    resetTexts,
  };
}
