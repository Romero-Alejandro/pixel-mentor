import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface UseTextSyncOptions {
  text: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  /** When audio starts speaking, this should change to trigger re-sync */
  isSpeaking?: boolean;
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
 * Custom hook for synchronizing text highlighting with audio playback.
 * Uses timeupdate event as single source of truth for state updates.
 */
export function useTextSync({
  text,
  audioElementGetter,
  isSpeaking,
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

  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/) : []), [text]);
  const totalWordCount = words.length;

  // Mutable refs for event-driven sync state
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const prevSpeakingRef = useRef<boolean | undefined>(undefined);
  const isListeningRef = useRef(false);

  // Memoize audio element reference to prevent getter instability
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

  // Reset audio reference when text changes (new audio loaded)
  useEffect(() => {
    audioElementRef.current = null;
  }, [text]);

  // Sync effect - runs when text changes or when isSpeaking starts
  useEffect(() => {
    if (totalWordCount === 0) {
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
        currentWordIndex: 0,
        progress: 0,
        isSynced: false,
        syncError: false,
        isAttemptingSync: true,
      });
    }
    prevSpeakingRef.current = isSpeaking;

    const syncAudio = (): (() => void) => {
      const audio = getAudioElement();
      if (!audio) {
        return () => {};
      }

      if (totalWordCount === 0) {
        return () => {};
      }

      isListeningRef.current = true;

      const handleTimeUpdate = (): void => {
        const currentAudio = getAudioElement();
        if (!currentAudio) return;

        const audioDuration = currentAudio.duration;
        const stableDuration =
          audioDuration &&
          audioDuration > 0.1 &&
          !isNaN(audioDuration) &&
          audioDuration < MAX_AUDIO_DURATION;

        if (!stableDuration || totalWordCount === 0) return;

        const wps = totalWordCount / audioDuration;
        const estimatedIndex = Math.min(Math.floor(currentAudio.currentTime * wps), totalWordCount);

        const isAudioNearEnd =
          currentAudio.duration &&
          !isNaN(currentAudio.duration) &&
          currentAudio.currentTime > currentAudio.duration - 0.5;

        const isCompleted =
          estimatedIndex >= totalWordCount || currentAudio.ended || isAudioNearEnd;

        setState((prev) => {
          const shouldBeSynced = isCompleted || (estimatedIndex > 0 && prev.isAttemptingSync);

          return {
            currentWordIndex: estimatedIndex,
            progress: estimatedIndex / (totalWordCount || 1),
            isSynced: shouldBeSynced,
            syncError: false,
            isAttemptingSync: !shouldBeSynced,
          };
        });
      };

      const handleError = (): void => {
        isListeningRef.current = false;
        setState((prev) => ({
          ...prev,
          syncError: true,
          isAttemptingSync: false,
        }));
      };

      const handleEnded = (): void => {
        setState({
          currentWordIndex: totalWordCount,
          progress: 1,
          isSynced: true,
          syncError: false,
          isAttemptingSync: false,
        });
        isListeningRef.current = false;
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('error', handleError);
      audio.addEventListener('ended', handleEnded);

      return () => {
        isListeningRef.current = false;
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('ended', handleEnded);
      };
    };

    const cleanup = syncAudio();

    return cleanup;
  }, [totalWordCount, getAudioElement, isSpeaking, text]);

  /**
   * Reset sync state - called when replaying audio
   */
  const reset = useCallback(() => {
    setState({
      currentWordIndex: 0,
      progress: 0,
      isSynced: false,
      syncError: false,
      isAttemptingSync: false,
    });
  }, []);

  return {
    ...state,
    words,
    reset,
  };
}