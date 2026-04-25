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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
     */
    const syncAudio = (): (() => void) | undefined => {
      // Guard: Prevent concurrent sync loops
      if (isListeningRef.current && !speakingJustStarted) {
        return undefined;
      }

      const audio = getAudioElement();
      if (!audio) {
        return undefined;
      }

      if (wordCount === 0) {
        return undefined;
      }

      isListeningRef.current = true;

      // Determine words-per-second based on audio duration
      let wps: number;
      if (
        audio.duration &&
        audio.duration > 0 &&
        !isNaN(audio.duration) &&
        audio.duration < MAX_AUDIO_DURATION
      ) {
        // Use actual audio duration for accurate timing
        wps = wordCount / audio.duration;
      } else {
        // Fallback: use estimated speech rate, adjusted for playback rate
        wps = (wordsPerSecond || DEFAULT_WPS) / playbackRate;
      }

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
        const safeCurrentTime = Math.min(currentAudio.currentTime, MAX_AUDIO_DURATION);

        // Calculate current word index based on elapsed time
        const estimatedIndex = Math.min(
          Math.floor(safeCurrentTime * wps * playbackRate),
          wordCount,
        );

        // Detect sync issues: check if audio time isn't advancing
        // audioTimeDelta near 0 with small safeCurrentTime indicates stalled audio
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

      // Cleanup function
      return () => {
        isListeningRef.current = false;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    };

    // Immediate sync attempt
    const cleanupImmediate = syncAudio();

    // Polling fallback: wait for audio to become available
    let pollCount = 0;
    const maxPolls = 60; // ~30 seconds max polling

    pollIntervalRef.current = setInterval((): void => {
      pollCount++;
      const audio = getAudioElement();

      // Attempt sync if audio exists and is playing
      if (audio && !audio.paused && !audio.ended && pollCount < maxPolls) {
        const cleanup = syncAudio();
        if (cleanup) {
          clearInterval(pollIntervalRef.current!);
        }
      }

      // Timeout: mark as error after max polls
      if (pollCount >= maxPolls) {
        clearInterval(pollIntervalRef.current!);
        setState((prev) => ({
          ...prev,
          syncError: true,
          isAttemptingSync: false,
        }));
      }
    }, 500);

    return (): void => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      isListeningRef.current = false;
      if (cleanupImmediate) cleanupImmediate();
    };
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
