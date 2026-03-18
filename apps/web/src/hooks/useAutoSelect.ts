import { useEffect, useCallback, useRef } from 'react';

import { api, type Session } from '@/services/api';

export interface AutoSelectConfig {
  /** Whether to auto-select a session if there's a resumable one */
  autoResume?: boolean;
  /** Maximum age of a session to consider resumable (in ms) */
  maxAgeMs?: number;
}

export interface AutoSelectState {
  /** The session ID to auto-select, or null if none */
  sessionToResume: string | null;
  /** Whether auto-selection is in progress */
  isLoading: boolean;
}

/**
 * Hook to auto-select a resumable session on the dashboard
 *
 * This checks for any in-progress sessions and returns the most recent one
 * that can be resumed.
 */
export function useAutoSelect(userId: string | null, config: AutoSelectConfig = {}) {
  const {
    autoResume = true,
    maxAgeMs = 7 * 24 * 60 * 60 * 1000, // 7 days default
  } = config;

  const isMountedRef = useRef(true);
  const sessionToResumeRef = useRef<string | null>(null);

  // Check if session status is resumable
  const isResumable = useCallback((status: string): boolean => {
    return [
      'IDLE',
      'ACTIVE',
      'PAUSED_FOR_QUESTION',
      'AWAITING_CONFIRMATION',
      'PAUSED_IDLE',
    ].includes(status);
  }, []);

  // Check if session is not too old
  const isNotTooOld = useCallback(
    (updatedAt: string | Date | undefined): boolean => {
      if (!updatedAt) return false;
      const sessionTime = new Date(updatedAt).getTime();
      const now = Date.now();
      return now - sessionTime < maxAgeMs;
    },
    [maxAgeMs],
  );

  // Find the most recent resumable session
  const findResumableSession = useCallback(async (): Promise<string | null> => {
    // Check if auto-select is disabled
    if (localStorage.getItem('autoSelectDisabled') === 'true') {
      return null;
    }

    if (!userId || !autoResume || !isMountedRef.current) {
      return null;
    }

    try {
      const sessions = await api.listSessions(userId, false);

      if (!isMountedRef.current) return null;

      // Find all resumable sessions that aren't too old
      const resumableSessions = sessions.filter(
        (session: Session) => isResumable(session.status) && isNotTooOld(session.updatedAt),
      );

      if (resumableSessions.length === 0) {
        return null;
      }

      // Sort by updatedAt (most recent first) and return the first one
      resumableSessions.sort((a: Session, b: Session) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

      return resumableSessions[0].id;
    } catch (error) {
      console.error('[useAutoSelect] Error finding resumable session:', error);
      return null;
    }
  }, [userId, autoResume, isResumable, isNotTooOld]);

  // Effect to find resumable session on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (userId && autoResume) {
      findResumableSession().then((sessionId) => {
        if (isMountedRef.current) {
          sessionToResumeRef.current = sessionId;
        }
      });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [userId, autoResume, findResumableSession]);

  // Get the current session to resume
  const getSessionToResume = useCallback((): string | null => {
    return sessionToResumeRef.current;
  }, []);

  // Clear the session to resume (after user has seen it)
  const clearSessionToResume = useCallback(() => {
    sessionToResumeRef.current = null;
  }, []);

  return {
    /** The session ID to auto-select, or null if none */
    sessionToResume: sessionToResumeRef.current,
    /** Function to get the session to resume (call after sessions load) */
    getSessionToResume,
    /** Clear the session to resume */
    clearSessionToResume,
    /** Check if there's a session to resume */
    hasResumableSession: () => sessionToResumeRef.current !== null,
  };
}
