import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface UseTextSyncOptions {
  text: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  /** When audio starts speaking, this should change to trigger re-sync */
  isSpeaking?: boolean;
  /** Block sync attempts until the audio element is confirmed ready. */
  audioElementReady?: boolean;
}

interface SyncState {
  currentWordIndex: number;
  progress: number;
  isSynced: boolean;
  /** Error state for sync failures */
  syncError: boolean;
  /** Whether we're actively trying to sync */
  isAttemptingSync: boolean;
}

const MAX_AUDIO_DURATION = 300;

/**
 * Calculates the current word index based on audio playback time using a
 * heuristic that accounts for variable word durations (longer words take more time).
 *
 * @param currentTime - Current audio playback time in seconds
 * @param audioDuration - Total audio duration in seconds
 * @param words - Array of words to synchronize with
 * @returns The index of the word currently being spoken
 */
function calculateWordIndexByTime(
  currentTime: number,
  audioDuration: number,
  words: string[],
): number {
  if (words.length === 0 || audioDuration <= 0) return 0;

  // Calculate total character count (excluding spaces) for weighted timing
  const totalChars = words.reduce((sum, word) => sum + word.length, 0);
  if (totalChars === 0) {
    // Fallback to linear if no characters
    const timePerWord = audioDuration / words.length;
    return Math.min(Math.floor(currentTime / timePerWord), words.length - 1);
  }

  // Calculate average time per character
  const timePerChar = audioDuration / totalChars;

  // Find the word being spoken by accumulating word durations
  let accumulatedTime = 0;
  for (let i = 0; i < words.length; i++) {
    const wordDuration = words[i].length * timePerChar;
    if (currentTime < accumulatedTime + wordDuration) {
      return i;
    }
    accumulatedTime += wordDuration;
  }

  // If past all words, return the last word index
  return words.length - 1;
}

/**
 * Custom hook for synchronizing text highlighting with audio playback.
 * Uses timeupdate event as single source of truth for state updates.
 */
export function useTextSync({
  text,
  audioElementGetter,
  isSpeaking,
  audioElementReady = true,
}: UseTextSyncOptions): {
  currentWordIndex: number;
  progress: number;
  isSynced: boolean;
  syncError: boolean;
  isAttemptingSync: boolean;
  words: string[];
  reset: () => void;
} {
  const [state, setState] = useState<SyncState>({
    currentWordIndex: 0,
    progress: 0,
    isSynced: false,
    syncError: false,
    isAttemptingSync: false,
  });

  const words = useMemo(() => {
    if (!text.trim()) return [];
    // Always split by words for karaoke highlighting
    return text.trim().split(/\s+/);
  }, [text]);
  const totalWordCount = words.length;

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const prevSpeakingRef = useRef<boolean | undefined>(undefined);
  const isListeningRef = useRef(false);
  // Store handler references so they can be removed during reset
  type AudioEventHandler = (this: HTMLAudioElement, ev: Event) => void;
  type ErrorEventHandler = (this: HTMLAudioElement, ev: ErrorEvent) => void;
  const handleTimeUpdateRef = useRef<AudioEventHandler | null>(null);
  const handleEndedRef = useRef<AudioEventHandler | null>(null);
  const handleErrorRef = useRef<ErrorEventHandler | null>(null);

  const getAudioElement = useCallback(() => {
    if (audioElementGetter) {
      // Always re-fetch the element from the getter to avoid stale references
      audioElementRef.current = audioElementGetter();
      return audioElementRef.current;
    }
    return null;
  }, [audioElementGetter]);

  useEffect(() => {
    audioElementRef.current = null;
  }, [text]);

  // BUGFIX: This entire effect is replaced to be more robust against race conditions
  // where the audio element is not immediately available when `isSpeaking` becomes true.
  useEffect(() => {
    if (totalWordCount === 0) {
      return;
    }

    const speakingJustStarted = isSpeaking && !prevSpeakingRef.current;
    if (speakingJustStarted) {
      setState((prev) => ({
        ...prev,
        currentWordIndex: 0,
        progress: 0,
        isSynced: false,
        syncError: false,
        isAttemptingSync: true,
      }));
    }
    prevSpeakingRef.current = isSpeaking;

    if (!isSpeaking) {
      if (isListeningRef.current) isListeningRef.current = false;
      return;
    }

    // Guard: wait for audio element to be ready on initial sync attempt only.
    // Once sync has started (isListeningRef.current = true), keep trying even if
    // audioElementReady flips later (handles the case where audio becomes available
    // while the effect is already running).
    if (speakingJustStarted && !audioElementReady) {
      return;
    }

    const audio = getAudioElement();
    if (!audio) {
      return;
    }

    if (isListeningRef.current) {
      return;
    }

    const handleTimeUpdate = (): void => {
      const currentAudio = getAudioElement();
      if (!currentAudio) return;

      const audioDuration = currentAudio.duration;

      // BUGFIX: Check for NaN duration
      if (isNaN(audioDuration) || !audioDuration || audioDuration <= 0.1) {
        setState((prev) => ({ ...prev, isAttemptingSync: false }));
        console.error('[useTextSync] Invalid audio duration:', audioDuration);
        return;
      }

      const stableDuration =
        audioDuration &&
        audioDuration > 0.1 &&
        !isNaN(audioDuration) &&
        audioDuration < MAX_AUDIO_DURATION;

      if (!stableDuration || totalWordCount === 0) return;

      // Use word-length-based heuristic for more accurate highlighting
      const estimatedIndex = calculateWordIndexByTime(
        currentAudio.currentTime,
        audioDuration,
        words,
      );

      setState((prev) => {
        const nowSynced = prev.isSynced || (prev.isAttemptingSync && estimatedIndex >= 0);
        return {
          currentWordIndex: estimatedIndex,
          progress: estimatedIndex / (totalWordCount || 1),
          isSynced: nowSynced,
          syncError: false,
          isAttemptingSync: prev.isAttemptingSync ? !nowSynced : false,
        };
      });
    };

    const handleError = (): void => {
      isListeningRef.current = false;
      setState((prev) => ({ ...prev, syncError: true, isAttemptingSync: false }));
    };

    const handleEnded = (): void => {
      isListeningRef.current = false;
      setState({
        currentWordIndex: totalWordCount,
        progress: 1,
        isSynced: true,
        syncError: false,
        isAttemptingSync: false,
      });
    };

    isListeningRef.current = true;
    handleTimeUpdateRef.current = handleTimeUpdate;
    handleEndedRef.current = handleEnded;
    handleErrorRef.current = handleError;
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      isListeningRef.current = false;
      handleTimeUpdateRef.current = null;
      handleEndedRef.current = null;
      handleErrorRef.current = null;
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isSpeaking, totalWordCount, getAudioElement, text, audioElementReady]);

  // Retry attach: if isAttemptingSync is true but we couldn't attach listeners
  // (because audioElementReady was false at the time), re-attach once it becomes ready.
  useEffect(() => {
    if (state.isAttemptingSync && !state.isSynced && audioElementReady) {
      const audio = getAudioElement();
      if (audio && !isListeningRef.current) {
        const handleTimeUpdate = (): void => {
          const currentAudio = getAudioElement();
          if (!currentAudio) return;
          const audioDuration = currentAudio.duration;
          if (isNaN(audioDuration) || !audioDuration || audioDuration <= 0.1) {
            setState((prev) => ({ ...prev, isAttemptingSync: false }));
            return;
          }
          const stableDuration =
            audioDuration > 0.1 && !isNaN(audioDuration) && audioDuration < MAX_AUDIO_DURATION;
          if (!stableDuration || totalWordCount === 0) return;
          // Use word-length-based heuristic for more accurate highlighting
          const estimatedIndex = calculateWordIndexByTime(
            currentAudio.currentTime,
            audioDuration,
            words,
          );
          setState((prev) => {
            const nowSynced = prev.isSynced || (prev.isAttemptingSync && estimatedIndex >= 0);
            return {
              currentWordIndex: estimatedIndex,
              progress: estimatedIndex / (totalWordCount || 1),
              isSynced: nowSynced,
              syncError: false,
              isAttemptingSync: prev.isAttemptingSync ? !nowSynced : false,
            };
          });
        };

        const handleError = (): void => {
          isListeningRef.current = false;
          setState((prev) => ({ ...prev, syncError: true, isAttemptingSync: false }));
        };

        const handleEnded = (): void => {
          isListeningRef.current = false;
          setState({
            currentWordIndex: totalWordCount,
            progress: 1,
            isSynced: true,
            syncError: false,
            isAttemptingSync: false,
          });
        };

        isListeningRef.current = true;
        handleTimeUpdateRef.current = handleTimeUpdate;
        handleEndedRef.current = handleEnded;
        handleErrorRef.current = handleError;
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('error', handleError);
        audio.addEventListener('ended', handleEnded);
      }
    }
  }, [audioElementReady, state.isAttemptingSync, state.isSynced, getAudioElement, totalWordCount]);

  const reset = useCallback((): void => {
    // Clean up event listeners on the audio element to prevent stale handlers
    const audio = getAudioElement();
    if (audio) {
      const tUpdate = handleTimeUpdateRef.current;
      const tEnded = handleEndedRef.current;
      const tError = handleErrorRef.current;
      if (tUpdate) audio.removeEventListener('timeupdate', tUpdate);
      if (tEnded) audio.removeEventListener('ended', tEnded);
      if (tError) audio.removeEventListener('error', tError);
    }
    isListeningRef.current = false;
    prevSpeakingRef.current = undefined;
    setState({
      currentWordIndex: 0,
      progress: 0,
      isSynced: false,
      syncError: false,
      isAttemptingSync: false,
    });
  }, [getAudioElement]);

  return {
    ...state,
    words,
    reset,
  };
}
