import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseTextSyncOptions {
  fullText: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  playbackRate?: number;
  wordsPerSecond?: number;
  /** When audio starts speaking, this should change to trigger re-sync */
  isSpeaking?: boolean;
}

export function useTextSync({
  fullText,
  audioElementGetter,
  playbackRate = 1.0,
  wordsPerSecond = 2.5,
  isSpeaking,
}: UseTextSyncOptions) {
  const [state, setState] = useState({
    visibleText: '',
    currentWordIndex: 0,
    progress: 0,
    isSynced: false,
  });

  const wordsRef = useRef<string[]>([]);
  const fullTextRef = useRef<string>('');
  const prevSpeakingRef = useRef<boolean | undefined>(undefined);
  const isListeningRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Store words and fullText in refs
  useEffect(() => {
    wordsRef.current = fullText.trim() ? fullText.trim().split(/\s+/) : [];
    fullTextRef.current = fullText;
    // Clear previous audio reference when fullText changes (new audio loaded)
    audioElementRef.current = null;
  }, [fullText]);

  // Sync effect - re-runs when fullText or isSpeaking changes
  useEffect(() => {
    const wordCount = wordsRef.current.length;

    // Don't proceed if no words
    if (wordCount === 0) {
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
      });
    }
    prevSpeakingRef.current = isSpeaking;

    const syncAudio = () => {
      // Guard: Prevent concurrent sync loops
      if (isListeningRef.current) {
        return;
      }

      const audio = getAudioElement();

      if (!audio) {
        return;
      }

      if (wordCount === 0) {
        return;
      }

      isListeningRef.current = true;

      // Determine words-per-second
      // For streaming audio, duration might not be available immediately
      let wps: number;
      if (audio.duration && audio.duration > 0 && !isNaN(audio.duration) && audio.duration < 300) {
        // Use actual audio duration only if it's reasonable (< 5 minutes)
        wps = wordCount / audio.duration;
      } else {
        // Fallback: average speech rate (130-150 wpm = ~2.3 wps)
        // Adjusted for playback rate
        wps = (wordsPerSecond || 2.3) / playbackRate;
      }

      const loop = () => {
        // Check if we should stop the loop
        if (audio.paused) {
          return;
        }

        // If audio has ended, mark as complete
        if (audio.ended) {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          setState({
            visibleText: fullTextRef.current,
            currentWordIndex: wordCount,
            progress: 1,
            isSynced: true,
          });
          isListeningRef.current = false;
          return;
        }

        // Calculate current word index based on elapsed time
        // Guard against unreasonable currentTime values
        const safeCurrentTime = Math.min(audio.currentTime, 300); // Cap at 5 minutes
        const estimatedIndex = Math.min(
          Math.floor(safeCurrentTime * wps * playbackRate),
          wordCount,
        );

        // Guard against jumping to end - if we're at the end but audio hasn't ended,
        // something is wrong with the calculation
        const isAudioNearEnd =
          audio.duration && !isNaN(audio.duration) && audio.currentTime > audio.duration - 0.5;

        // Update state only if changed and reasonable
        setState((prev) => {
          let newIndex = estimatedIndex;

          // If we jumped to the end unexpectedly, cap it
          if (estimatedIndex >= wordCount && !isAudioNearEnd && !audio.ended) {
            newIndex = Math.min(prev.currentWordIndex + 1, wordCount);
          }

          if (newIndex !== prev.currentWordIndex) {
            const isCompleted = newIndex >= wordCount;
            return {
              visibleText: isCompleted
                ? fullTextRef.current
                : wordsRef.current.slice(0, newIndex).join(' ') + '...',
              currentWordIndex: newIndex,
              progress: newIndex / (wordCount || 1),
              isSynced: isCompleted,
            };
          }
          return prev;
        });

        rafIdRef.current = requestAnimationFrame(loop);
      };

      // Start the loop if audio is already playing and hasn't ended
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

    // Try to sync immediately
    const cleanupImmediate = syncAudio();

    // Also set up polling for when audio becomes available
    let pollCount = 0;
    pollIntervalRef.current = setInterval(() => {
      pollCount++;
      const audio = getAudioElement();

      // Only attempt sync if:
      // 1. Audio exists
      // 2. Audio is not paused and not ended
      // 3. Haven't polled too many times (cap at 15 seconds)
      if (audio && !audio.paused && !audio.ended && pollCount < 30) {
        const clean = syncAudio();
        if (clean) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      }

      // Stop polling after ~15 seconds
      if (pollCount >= 30) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      }
    }, 500);

    return () => {
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

  const reset = useCallback(() => {
    setState({ visibleText: '', currentWordIndex: 0, progress: 0, isSynced: false });
  }, []);

  return { ...state, reset };
}
