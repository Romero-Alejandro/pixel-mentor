/**
 * useClassOrchestrator
 *
 * Thin coordinator that composes:
 *   - useLessonInteractions (lock management, API calls, streaming)
 *   - useLessonAutoAdvance (response processing, auto-advance)
 *
 * This hook is the public API consumed by lesson components.
 * It was ~500 lines before refactoring; now ~120 lines.
 */

import { useCallback } from 'react';

import { useLessonInteractions, type Result } from './useLessonInteractions';
import { useLessonAutoAdvance } from './useLessonAutoAdvance';
import { useLessonState } from './useLessonState';
import { getVoiceSettings } from './useVoiceSettingsSync';
import { useVoice } from '@/features/voice/hooks/useVoice';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';
import { api, type SessionStatus } from '@/services/api';

// ---- Re-export shared types and hooks ----

export type { Result, LessonResponse } from './useLessonInteractions';
export { SSEError } from './useLessonInteractions';
export { useVoiceSettingsSync } from './useVoiceSettingsSync';

// Backend terminal statuses: a persisted session in one of these is expired
// and must never be restored (see isTerminalStatus server-side).
const TERMINAL_SESSION_STATUSES = {
  COMPLETED: 'COMPLETED',
  ESCALATED: 'ESCALATED',
} as const;

function isSessionResumable(status: SessionStatus): boolean {
  return (
    status !== TERMINAL_SESSION_STATUSES.COMPLETED &&
    status !== TERMINAL_SESSION_STATUSES.ESCALATED
  );
}

/** True only for a definitive 404: the backend session is gone. */
function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (!('response' in error)) return false;
  const response: unknown = error.response;
  if (typeof response !== 'object' || response === null) return false;
  if (!('status' in response)) return false;
  return response.status === 404;
}

// In-flight backend validations keyed by sessionId. StrictMode mounts the
// tree twice in dev, so two restore calls race for the same session: sharing
// one promise keeps validation side-effect free (single GET, no double
// restore) while the ref writes stay idempotent compare-and-set.
const pendingSessionValidations = new Map<string, Promise<boolean>>();

function validatePersistedSession(sessionId: string): Promise<boolean> {
  const pending = pendingSessionValidations.get(sessionId);
  if (pending) return pending;
  const validation = (async (): Promise<boolean> => {
    try {
      const session = await api.getSession(sessionId);
      return isSessionResumable(session.status);
    } catch (error: unknown) {
      // Fail open on transient errors (network): only a definitive 404
      // proves the session is gone. Anything else keeps the refs so a live
      // session is never cleared by a blip.
      if (isNotFoundError(error)) return false;
      return true;
    } finally {
      pendingSessionValidations.delete(sessionId);
    }
  })();
  pendingSessionValidations.set(sessionId, validation);
  return validation;
}

export function useClassOrchestrator() {
  const lessonState = useLessonState();

  // Single shared voice instance for the whole lesson flow: the same voice
  // that speaks is the one interactions observes (isSpeaking, audio element,
  // sync info). A second useVoice() here would stay silent and karaoke (among
  // others) would read the mute instance forever.
  const {
    speak,
    stopSpeaking: voiceStop,
    isSpeaking,
    getCurrentAudioElement,
    getAudioSyncInfo,
    getActiveEngine,
    audioElementReady,
  } = useVoice();

  // ---- Compose hooks ----
  const interactions = useLessonInteractions({
    speak,
    voiceStop,
    isSpeaking,
    getAudio: getCurrentAudioElement,
    getSyncInfo: getAudioSyncInfo,
    getActiveEngine,
    audioElementReady,
  });

  const autoAdvance = useLessonAutoAdvance({
    doInteract: interactions.doInteract,
    speak,
    voiceSettings: getVoiceSettings(),
    isInteractingRef: interactions.isInteractingRef,
    lessonState,
  });

  // ---- Start Class ----

  const startClass = useCallback(
    async (lessonId: string): Promise<Result<void, Error>> => {
      interactions.cleanup();
      lessonState.setIsProcessing(true);

      try {
        const result = await interactions.startClass(lessonId);
        if (!result.ok) return result;

        await autoAdvance.processResponse(result.value, true);
        return { ok: true, value: undefined };
      } catch (e) {
        return { ok: false, error: e as Error };
      } finally {
        lessonState.setIsProcessing(false);
      }
    },
    [interactions, lessonState, autoAdvance],
  );

  // ---- Submit Answer ----

  const submitAnswer = useCallback(
    async (ans: string) => {
      lessonState.setError(null); // Clear previous error
      lessonState.setIsProcessing(true);
      try {
        const res = await interactions.doInteract(ans);
        if (res) await autoAdvance.processResponse(res, false);
      } catch (err: unknown) {
        // Surface structured error message to UI
        const message = autoAdvance.getErrorMessage(err);
        lessonState.setError(message);
        throw err;
      } finally {
        lessonState.setIsProcessing(false);
      }
    },
    [interactions, lessonState, autoAdvance],
  );

  // ---- Speak Content ----

  const speakContent = useCallback(() => {
    return autoAdvance.contentRef.current && speak(autoAdvance.contentRef.current);
  }, [autoAdvance, speak]);

  // ---- Restore persisted session (step-level resume) ----

  // Rehydrates the persisted { sessionId, lessonId, currentStep } into the
  // in-memory session refs after a reload/remount. Step-level only: refs +
  // step progress are restored, never an intra-chunk playback offset
  // (contentRef/fullVoiceText stay empty until startClass resolves).
  const restorePersistedSession = useCallback(
    async (routeLessonId: string | null): Promise<boolean> => {
      // A live in-memory session always wins: never overwrite refs that an
      // in-flight start already populated (StrictMode remount, auto-start).
      if (interactions.sessionIdRef.current !== null) return false;
      if (!routeLessonId) return false;

      const persisted = useLessonStore.getState();
      const persistedSessionId = persisted.sessionId;
      const persistedLessonId = persisted.lessonId;
      if (
        typeof persistedSessionId !== 'string' ||
        persistedSessionId.length === 0 ||
        persistedLessonId !== routeLessonId
      ) {
        return false;
      }
      const persistedStep =
        typeof persisted.currentStep === 'number' && Number.isFinite(persisted.currentStep)
          ? persisted.currentStep
          : 0;
      const persistedTotal =
        typeof persisted.totalSteps === 'number' && Number.isFinite(persisted.totalSteps)
          ? persisted.totalSteps
          : 0;

      const wrote = interactions.restoreSessionRefs(persistedSessionId, persistedLessonId);
      if (!wrote) return false;
      persisted.setCurrentStep(persistedStep);
      persisted.setTotalSteps(persistedTotal);
      lessonState.setCurrentStep(persistedStep);
      lessonState.setTotalSteps(persistedTotal);

      const valid = await validatePersistedSession(persistedSessionId);
      if (useLessonStore.getState().sessionId !== persistedSessionId) {
        // A concurrent startClass already moved on (fresh or server-resumed
        // session); this verdict is stale — leave the live session untouched.
        return false;
      }
      if (!valid) {
        // Expired/inactive backend session: drop it so the pending auto-start
        // creates a fresh one instead of interacting with a dead session.
        interactions.clearSessionRefs(persistedSessionId);
        persisted.setSessionId(null);
        persisted.setLessonId(null);
        persisted.setCurrentStep(0);
        persisted.setTotalSteps(0);
        persisted.setWasResumed(false);
        lessonState.setCurrentStep(0);
        lessonState.setTotalSteps(0);
        return false;
      }
      persisted.setWasResumed(true);
      return true;
    },
    [interactions, lessonState],
  );

  // ---- Reset ----

  const reset = useCallback(
    async (onResetComplete?: () => void) => {
      // Kill any in-flight processResponse→speak→autoAdvance chain first so
      // no stale step speaks or fetches after the session is torn down.
      autoAdvance.cancelGeneration();

      // Step 1: Stop audio and reset voice state
      interactions.voiceStop();
      interactions.stopStream();

      // NOTE: no audio-element readiness wait here — voiceStop() just marked
      // it not-ready and nothing makes it ready again before the next
      // playback, so waiting always burned the full timeout on restart.

      // Reset the stale backend session BEFORE clearing local refs: awaiting
      // it (instead of fire-and-forget) closes the race where a fresh start
      // reuses a session the backend has not finished resetting yet.
      const staleSessionId = interactions.sessionIdRef.current;
      if (!staleSessionId) {
        lessonState.setError('No hay sesion activa para reiniciar.');
      } else {
        try {
          await api.resetSession(staleSessionId);
        } catch (error: unknown) {
          console.error('[LESSON_RESET] Backend reset failed:', error);
          lessonState.setError('No se pudo reiniciar la sesion en el servidor. Intenta de nuevo.');
        }
      }

      // Cleanup
      if (interactions.abortControllerRef.current) {
        interactions.abortControllerRef.current.abort();
        interactions.abortControllerRef.current = null;
      }

      interactions.isInteractingRef.current = false;

      // Reset local state (including spoken texts so nothing stale flashes)
      interactions.sessionIdRef.current = null;
      autoAdvance.resetTexts();

      if (onResetComplete) {
        onResetComplete();
      }

      // Step 3: Reset global state
      lessonState.resetState();
      lessonState.setUIState('idle');
      interactions.cleanup();
    },
    [interactions, lessonState, autoAdvance],
  );

  // ---- Cancel (unmount-safe teardown) ----

  const cancel = useCallback(() => {
    // Abort in-flight requests and silence audio WITHOUT touching the
    // shared session ref, backend session, or UI state. Safe to run from
    // a (possibly StrictMode fake) unmount cleanup: it can never poison
    // a fresh start running on the same refs. Also bumps the auto-advance
    // generation so a stale processResponse chain cannot speak or fetch.
    autoAdvance.cancelGeneration();
    interactions.cleanup();
  }, [interactions, autoAdvance]);

  // ---- Clear Error ----

  const clearError = useCallback(() => {
    lessonState.setError(null);
  }, [lessonState]);

  // ---- Public API ----

  return {
    ...lessonState,
    clearError,
    transitionText: autoAdvance.transitionText,
    closureText: autoAdvance.closureText,
    fullVoiceText: autoAdvance.fullVoiceText,
    startClass,
    submitAnswer,
    speakContent,
    restorePersistedSession,
    reset,
    cancel,
    getSyncInfo: interactions.getSyncInfo,
    getActiveEngine: interactions.getActiveEngine,
    stopSpeaking: interactions.voiceStop,
    getCurrentAudioElement: interactions.getAudio,
    audioElementReady: interactions.audioElementReady,
  };
}
