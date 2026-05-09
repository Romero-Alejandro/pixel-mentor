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
 * Custom hook for synchronizing text highlighting with audio playback.
 * Uses timeupdate event as single source of truth for state updates.
 */
export function useTextSync({ text, audioElementGetter, isSpeaking, audioElementReady = true }: UseTextSyncOptions): {
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
    const sentences = text.trim().match(/[^.!?]+[.!?]*/g) || [];
    // BUGFIX: Use > 1 to ensure it only uses sentences if there are multiple.
    // This allows the fallback to word splitting to work for single sentences.
    return sentences.length > 1 ? sentences : text.trim().split(/\s+/);
  }, [text]);
  const totalWordCount = words.length;

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const prevSpeakingRef = useRef<boolean | undefined>(undefined);
  const isListeningRef = useRef(false);

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
    console.debug('[KARAOKE-DEBUG] useTextSync: SyncTriggered', JSON.stringify({ isSpeaking }));
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
      console.debug('[KARAOKE-DEBUG] useTextSync: waiting for audioElementReady');
      return;
    }

    const audio = getAudioElement();
    if (!audio) {
      // Audio element isn't ready. The effect will re-run on the next render.
      // The `isAttemptingSync` state remains true, showing the user a loading state.
      console.debug('[KARAOKE-DEBUG] useTextSync: AudioElementCheck', JSON.stringify({ isAudioNull: true }));
      return;
    }

    console.debug('[KARAOKE-DEBUG] useTextSync: AudioElementCheck', JSON.stringify({ isAudioNull: false }));

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

      const timePerSegment = audioDuration / totalWordCount;
      const estimatedIndex = Math.min(
        Math.round(currentAudio.currentTime / timePerSegment),
        totalWordCount - 1,
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
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      isListeningRef.current = false;
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isSpeaking, totalWordCount, getAudioElement, text, audioElementReady]);

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
