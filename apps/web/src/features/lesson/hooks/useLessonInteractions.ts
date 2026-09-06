/**
 * useLessonInteractions
 *
 * Encapsulates:
 *   - Interaction lock management (acquire/release with 30s timeout)
 *   - API calls (interact with recipe, start class)
 *   - SSE streaming coordination
 *
 * Extracted from useClassOrchestrator to separate concerns.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { EventSourceMessage } from '@microsoft/fetch-event-source';

import { api, streamInteractWithRecipe, type PedagogicalState } from '@/services/api';
import { useChatStream } from './useChatStream';
import type {
  VoiceSettings,
  AudioSyncInfo,
  ActiveTTSEngine,
} from '@/features/voice/hooks/useVoice';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';

// ---- Types ----

export interface LessonResponse {
  voiceText?: string;
  pedagogicalState?: PedagogicalState;
  isCorrect?: boolean | null;
  feedback?: string;
  sessionCompleted?: boolean;
  lessonProgress?: { currentStep: number; totalSteps: number };
  resolvedStaticContent?: {
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
  /** Backend SSE sends 'staticContent' — alias for resolvedStaticContent */
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
  contentSteps?: {
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
  /** True when the backend resumed an existing session (step-level resume). */
  resumed?: boolean;
  /** True when the client must drive the start flow (AWAITING_START). */
  needsStart?: boolean;
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

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

const INTERACTION_LOCK_TIMEOUT_MS = 30_000;
/**
 * Structured error from SSE error events.
 * Contains the error code and user message from the backend.
 */
export class SSEError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SSEError';
  }
}

// ---- Hook ----

/**
 * Voice dependencies injected by useClassOrchestrator, which owns the single
 * shared useVoice instance. This hook must NOT call useVoice() itself:
 * a second instance would stay silent while the orchestrator's instance
 * speaks, and every voice observer (isSpeaking, audio element, sync info)
 * would read the mute one — karaoke among them.
 */
export interface UseLessonInteractionsParams {
  speak: (text: string, settings?: VoiceSettings) => Promise<boolean>;
  voiceStop: () => void;
  isSpeaking: boolean;
  getAudio: () => HTMLAudioElement | null;
  getSyncInfo: () => AudioSyncInfo | null;
  getActiveEngine: () => ActiveTTSEngine | null;
  audioElementReady: boolean;
}

export function useLessonInteractions({
  speak,
  voiceStop,
  isSpeaking,
  getAudio,
  getSyncInfo,
  getActiveEngine,
  audioElementReady,
}: UseLessonInteractionsParams) {
  const store = useLessonStore(
    useShallow((state) => ({
      setSessionId: state.setSessionId,
      setIsSpeaking: state.setIsSpeaking,
      setIsStreaming: state.setIsStreaming,
      setStreamError: state.setStreamError,
      clearStream: state.clearStream,
      setIsRepeat: state.setIsRepeat,
      setWasResumed: state.setWasResumed,
      reset: state.reset,
    })),
  );

  const { stopStream } = useChatStream();

  // ---- Refs ----
  const sessionIdRef = useRef<string | null>(null);
  const lessonIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInteractingRef = useRef(false);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Lock Management ----

  const releaseLock = useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    isInteractingRef.current = false;
  }, []);

  const acquireLock = useCallback(() => {
    isInteractingRef.current = true;
    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    lockTimeoutRef.current = setTimeout(() => {
      if (isInteractingRef.current) {
        console.warn('[useLessonInteractions] Interaction lock force-released after timeout');
        isInteractingRef.current = false;
        store.setIsStreaming(false);
      }
    }, INTERACTION_LOCK_TIMEOUT_MS);
  }, [store]);

  // ---- Cleanup ----

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    releaseLock();
    stopStream();
    voiceStop();
  }, [releaseLock, stopStream, voiceStop]);

  useEffect(() => {
    store.setIsSpeaking(isSpeaking);
  }, [isSpeaking, store]);

  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      cleanup();
    };
  }, [cleanup]);

  // ---- Persisted-session restore primitives ----

  // Single-writer access to the live session refs for step-level resume:
  // after a reload the persisted store still holds sessionId/lessonId but
  // these in-memory refs are null again. The restore policy lives in
  // useClassOrchestrator; these primitives only provide compare-and-set
  // semantics so concurrent flows (StrictMode remount, auto-start) can
  // never clobber a live session.
  const restoreSessionRefs = useCallback((sessionId: string, lessonId: string): boolean => {
    if (sessionIdRef.current !== null) return false;
    sessionIdRef.current = sessionId;
    lessonIdRef.current = lessonId;
    return true;
  }, []);

  const clearSessionRefs = useCallback((sessionId: string): void => {
    if (sessionIdRef.current === sessionId) {
      sessionIdRef.current = null;
      lessonIdRef.current = null;
    }
  }, []);

  // ---- Core Interaction ----

  const doInteract = useCallback(
    async (input: string, retries = 3): Promise<LessonResponse | null> => {
      if (isInteractingRef.current) return null;

      const sid = sessionIdRef.current;
      if (!sid) throw new Error('Sesion no activa');

      acquireLock();

      try {
        if (import.meta.env.VITE_ENABLE_STREAMING === 'true') {
          let fullText = '';
          let sseError: Error | null = null;
          store.setIsStreaming(true);
          store.setStreamError(null);
          store.clearStream();

          return await new Promise<LessonResponse>((resolve, reject) => {
            let resolved = false;
            const finalize = () => {
              if (resolved) return;
              resolved = true;
              releaseLock();
              store.setIsStreaming(false);
            };

            const controller = streamInteractWithRecipe(
              sid,
              input,
              {
                onMessage: (event: EventSourceMessage) => {
                  if (event.event === 'end') {
                    try {
                      const data = JSON.parse(event.data);
                      finalize();
                      resolve({ ...data, voiceText: fullText });
                    } catch {
                      finalize();
                      reject(new Error('Error parsing stream end data'));
                    }
                  } else if (event.event === 'error') {
                    // Structured error from backend
                    try {
                      const data = JSON.parse(event.data);
                      const code = data.code ?? 'STREAM_ERROR';
                      const message = data.message ?? 'Error en la transmision';
                      const userMessage = data.userMessage ?? message;
                      sseError = new SSEError(message, code, userMessage, data.statusCode);
                      store.setStreamError(userMessage);
                    } catch {
                      sseError = new Error(event.data || 'Error en la transmision');
                      store.setStreamError(sseError.message);
                    }
                  } else if (event.event === 'chunk') {
                    try {
                      const data = JSON.parse(event.data);
                      fullText += data.text || '';
                    } catch {
                      // Ignore malformed chunks to not break the stream
                    }
                  }
                },
                onError: (err) => {
                  if (!resolved) {
                    finalize();
                    reject(err);
                  }
                },
                onClose: (reason) => {
                  if (resolved) return;
                  finalize();
                  if (reason === 'error' && sseError) {
                    // Structured SSE error — reject so caller can handle it
                    reject(sseError);
                  } else if (reason === 'error') {
                    reject(new Error('Conexion con el servidor perdida'));
                  } else if (reason === 'completed' && !fullText) {
                    // Completed but no text received — return empty response
                    resolve({
                      voiceText: '',
                      pedagogicalState: 'EXPLANATION',
                      sessionCompleted: false,
                      lessonProgress: { currentStep: 1, totalSteps: 10 },
                    });
                  } else if (reason !== 'completed') {
                    // Unknown close — treat as error
                    reject(new Error('Conexion interrumpida'));
                  }
                  // reason === 'completed' with fullText is handled by onMessage('end')
                },
              },
              {
                onRetry: (attempt, maxRetries, delayMs) => {
                  const msg = `Reconectando... (${attempt}/${maxRetries}, ${Math.round(delayMs / 1000)}s)`;
                  store.setStreamError(msg);
                },
              },
            );
            abortControllerRef.current = controller;
          });
        }

        return (await api.interactWithRecipe(sid, input)) as LessonResponse;
      } catch (err: unknown) {
        if (retries > 0 && err instanceof Error && err.message.includes('429')) {
          await new Promise((r) => setTimeout(r, 1000));
          releaseLock();
          return doInteract(input, retries - 1);
        }
        throw err;
      } finally {
        releaseLock();
      }
    },
    [store, acquireLock, releaseLock],
  );

  // ---- Start Class ----

  const startClass = useCallback(
    async (lessonId: string): Promise<Result<LessonResponse, Error>> => {
      cleanup();
      lessonIdRef.current = lessonId;

      try {
        const classId = await api.getClassIdByLessonId(lessonId);
        if (!classId) {
          throw new Error('No se encontro la clase asociada a esta leccion');
        }
        const result = await api.startClass(classId);
        sessionIdRef.current = result.sessionId;
        store.setSessionId(result.sessionId);
        store.setIsRepeat(!!result.isRepeat);
        store.setWasResumed(result.resumed === true);

        return { ok: true, value: result as LessonResponse };
      } catch (e) {
        return { ok: false, error: e as Error };
      }
    },
    [cleanup, store],
  );

  // ---- Public API ----

  return {
    doInteract,
    startClass,
    cleanup,
    restoreSessionRefs,
    clearSessionRefs,
    sessionIdRef,
    lessonIdRef,
    isInteractingRef,
    abortControllerRef,
    speak,
    voiceStop,
    stopStream,
    getAudio,
    getSyncInfo,
    getActiveEngine,
    audioElementReady,
  };
}
