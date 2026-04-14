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

  // Store words and fullText in refs
  useEffect(() => {
    wordsRef.current = fullText.trim() ? fullText.trim().split(/\s+/) : [];
    fullTextRef.current = fullText;
  }, [fullText]);

  // Sync effect - re-runs when fullText or isSpeaking changes
  useEffect(() => {
    const wordCount = wordsRef.current.length;

    // Don't proceed if no words
    if (wordCount === 0) {
      return;
    }

    let rafId: number | null = null;
    let isListening = false;

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
      // Skip if already listening
      if (isListening) {
        return;
      }

      const audio = audioElementGetter?.();

      if (!audio) {
        return;
      }

      if (wordCount === 0) {
        return;
      }

      isListening = true;

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
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          setState({
            visibleText: fullTextRef.current,
            currentWordIndex: wordCount,
            progress: 1,
            isSynced: true,
          });
          isListening = false;
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

        rafId = requestAnimationFrame(loop);
      };

      // Start the loop if audio is already playing and hasn't ended
      if (!audio.paused && !audio.ended) {
        rafId = requestAnimationFrame(loop);
      }

      // Cleanup function
      return () => {
        isListening = false;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
    };

    // Try to sync immediately
    const cleanupImmediate = syncAudio();

    // Also set up polling for when audio becomes available
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      const audio = audioElementGetter?.();

      // Only attempt sync if:
      // 1. Audio exists
      // 2. Audio is not paused and not ended
      // 3. Haven't polled too many times (cap at 15 seconds)
      if (audio && !audio.paused && !audio.ended && pollCount < 30) {
        const clean = syncAudio();
        if (clean) {
          clearInterval(pollInterval);
        }
      }

      // Stop polling after ~15 seconds
      if (pollCount >= 30) {
        clearInterval(pollInterval);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
      if (cleanupImmediate) cleanupImmediate();
    };
  }, [fullText, audioElementGetter, playbackRate, wordsPerSecond, isSpeaking]);

  const reset = useCallback(() => {
    setState({ visibleText: '', currentWordIndex: 0, progress: 0, isSynced: false });
  }, []);

  return { ...state, reset };
}
