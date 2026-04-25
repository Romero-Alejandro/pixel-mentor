import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseTextSyncOptions {
  fullText: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  playbackRate?: number;
  wordsPerSecond?: number;
  /** When audio starts speaking, this should change to trigger re-sync */
  isSpeaking?: boolean;
}

interface SyncState {
  visibleText: string;
  currentWordIndex: number;
  progress: number;
  isSynced: boolean;
  /** Error state for sync failures */
  syncError: boolean;
  /** Whether we're actively trying to sync */
  isAttemptingSync: boolean;
}

const DEFAULT_WPS = 2.3; // ~138 wpm average speech rate
const SYNC_RECOVERY_THRESHOLD = 3; // Max consecutive same-index updates before forcing resync
const MAX_AUDIO_DURATION = 300; // 5 minutes cap

/**
 * Custom hook for synchronizing text highlighting with audio playback.
 * Provides real-time word index tracking, automatic sync recovery, and graceful fallback.
 */
export function useTextSync({
  fullText,
  audioElementGetter,
  playbackRate = 1.0,
  wordsPerSecond = DEFAULT_WPS,
  isSpeaking,
}: UseTextSyncOptions): {
  visibleText: string;
  currentWordIndex: number;
  progress: number;
  isSynced: boolean;
  syncError: boolean;
  isAttemptingSync: boolean;
  reset: () => void;
} {
  const [state, setState] = useState<SyncState>({
    visibleText: '',
    currentWordIndex: 0,
    progress: 0,
    isSynced: false,
    syncError: false,
    isAttemptingSync: false,
  });

  const wordsRef = useRef<string[]>([]);
  const fullTextRef = useRef<string>('');
  const prevSpeakingRef = useRef<boolean | undefined>(undefined);
  const isListeningRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Recovery tracking
  const staleCountRef = useRef(0);
  const lastAudioTimeRef = useRef(0);

  // Memoize audio element reference to prevent getter instability
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const getAudioElement = useCallback(() => {
    if (audioElementRef.current) {
      return audioElementRef.current;
    }
    if (audioElementGetter) {
      audioElementRef.current = audioElementGetter();
      return audioElementRef.current;
    }
    return null;
  }, [audioElementGetter]);

  // Store words and fullText in refs - only update when fullText changes
  useEffect(() => {
    wordsRef.current = fullText.trim() ? fullText.trim().split(/\s+/) : [];
    fullTextRef.current = fullText;
    // Reset audio reference when text changes (new audio loaded)
    audioElementRef.current = null;
  }, [fullText]);

  // Sync effect - runs when text changes or when isSpeaking starts
  useEffect(() => {
    const wordCount = wordsRef.current.length;

    // Don't proceed if no words
    if (wordCount === 0) {
      setState((prev) => ({
        ...prev,
        syncError: false,
        isAttemptingSync: false,
      }));
      return;
    }

    // Reset state when isSpeaking transitions from false to true (new audio started)
    const speakingJustStarted = isSpeaking && prevSpeakingRef.current === false;
    if (speakingJustStarted) {
      setState({
        visibleText: '',
        currentWordIndex: 0,
        progress: 0,
        isSynced: false,
        syncError: false,
        isAttemptingSync: true,
      });
      // Reset recovery tracking
      staleCountRef.current = 0;
      lastAudioTimeRef.current = 0;
    }
    prevSpeakingRef.current = isSpeaking;

    /**
     * Core sync function - tracks audio position and updates word index
     * Returns cleanup function for event listeners
     */
    const syncAudio = (): (() => void) => {
      const audio = getAudioElement();
      if (!audio) {
        return () => {};
      }

      if (wordCount === 0) {
        return () => {};
      }

      isListeningRef.current = true;

      /**
       * Main sync loop using requestAnimationFrame for smooth updates
       */
      const loop = (): void => {
        const currentAudio = getAudioElement();

        // Guard: audio element may have changed
        if (!currentAudio) {
          isListeningRef.current = false;
          return;
        }

        // Check if we should stop the loop
        if (currentAudio.paused) {
          return;
        }

        // If audio has ended, mark as complete
        if (currentAudio.ended) {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          setState({
            visibleText: fullTextRef.current,
            currentWordIndex: wordCount,
            progress: 1,
            isSynced: true,
            syncError: false,
            isAttemptingSync: false,
          });
          isListeningRef.current = false;
          return;
        }

        // Guard against unreasonable currentTime values
        const safeCurrentTime = Math.min(
          currentAudio.currentTime,
          currentAudio.duration && !isNaN(currentAudio.duration)
            ? currentAudio.duration
            : MAX_AUDIO_DURATION,
        );

        // Guard: require stable duration before calculating word index
        const stableDuration =
          currentAudio.duration &&
          currentAudio.duration > 0.1 &&
          !isNaN(currentAudio.duration) &&
          currentAudio.duration < MAX_AUDIO_DURATION;

        let estimatedIndex: number;

        if (stableDuration) {
          const wps = wordCount / currentAudio.duration;
          estimatedIndex = Math.min(Math.floor(safeCurrentTime * wps), wordCount);
        } else {
          // Duration not stable yet - don't update
          rafIdRef.current = requestAnimationFrame(loop);
          return;
        }

        // Detect sync issues: check if audio time isn't advancing
        const audioTimeDelta = Math.abs(safeCurrentTime - lastAudioTimeRef.current);
        lastAudioTimeRef.current = safeCurrentTime;

        // If audio is advancing slowly (delta < 0.1s over 2 frames), consider it stalled
        const isAudioStalled =
          audioTimeDelta < 0.1 &&
          safeCurrentTime > 0 &&
          safeCurrentTime < currentAudio.duration - 1;

        // Guard against jumping to end unexpectedly
        const isAudioNearEnd =
          currentAudio.duration &&
          !isNaN(currentAudio.duration) &&
          currentAudio.currentTime > currentAudio.duration - 0.5;

        setState((prev) => {
          let newIndex = estimatedIndex;
          let newSyncError = prev.syncError;

          // Recovery: if estimated index jumped to end but audio hasn't ended,
          // OR if audio is stalled (not advancing), cap progress and trigger recovery flag
          if (
            (estimatedIndex >= wordCount && !isAudioNearEnd && !currentAudio.ended) ||
            isAudioStalled
          ) {
            newIndex = Math.min(prev.currentWordIndex + 1, wordCount);
            staleCountRef.current += 1;

            // After threshold, flag sync error for recovery
            if (staleCountRef.current >= SYNC_RECOVERY_THRESHOLD) {
              newSyncError = true;
            }
          } else {
            // Reset stale count when progress is normal
            staleCountRef.current = 0;
            newSyncError = false;
          }

          // Only update if index changed
          if (newIndex !== prev.currentWordIndex) {
            const isCompleted = newIndex >= wordCount;
            return {
              visibleText: isCompleted
                ? fullTextRef.current
                : wordsRef.current.slice(0, newIndex).join(' ') + '...',
              currentWordIndex: newIndex,
              progress: newIndex / (wordCount || 1),
              isSynced: isCompleted,
              syncError: newSyncError,
              isAttemptingSync: !isCompleted,
            };
          }

          return {
            ...prev,
            isAttemptingSync: prev.isSynced ? false : true,
          };
        });

        rafIdRef.current = requestAnimationFrame(loop);
      };

      // Start the loop if audio is playing
      if (!audio.paused && !audio.ended) {
        rafIdRef.current = requestAnimationFrame(loop);
      }

      // Event listener cleanup holder
      let listenersAttached = false;

      const handlePlaying = (): void => {
        if (!isListeningRef.current) {
          isListeningRef.current = true;
          rafIdRef.current = requestAnimationFrame(loop);
        }
      };

      const handleDurationChange = (): void => {
        if (!audio.paused && !audio.ended && isListeningRef.current) {
          rafIdRef.current = requestAnimationFrame(loop);
        }
      };

      const handleError = (): void => {
        isListeningRef.current = false;
        setState((prev) => ({
          ...prev,
          syncError: true,
          isAttemptingSync: false,
        }));
      };

      audio.addEventListener('playing', handlePlaying);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('error', handleError);
      listenersAttached = true;

      // Cleanup function
      return () => {
        isListeningRef.current = false;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (listenersAttached) {
          audio.removeEventListener('playing', handlePlaying);
          audio.removeEventListener('durationchange', handleDurationChange);
          audio.removeEventListener('error', handleError);
        }
      };
    };

    // Start event-driven sync
    const cleanup = syncAudio();

    return cleanup;
  }, [fullText, getAudioElement, playbackRate, wordsPerSecond, isSpeaking]);

  /**
   * Reset sync state - called when replaying audio
   */
  const reset = useCallback(() => {
    setState({
      visibleText: '',
      currentWordIndex: 0,
      progress: 0,
      isSynced: false,
      syncError: false,
      isAttemptingSync: false,
    });
    staleCountRef.current = 0;
    lastAudioTimeRef.current = 0;
  }, []);

  return { ...state, reset };
}
