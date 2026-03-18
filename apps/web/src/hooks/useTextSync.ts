/**
 * useTextSync.ts
 *
 * Hook for progressive text reveal synchronized with audio playback.
 * Supports streaming TTS and HTTP TTS modes.
 *
 * Key implementation details:
 * - Uses wall-clock timing (Date.now()) instead of audio.currentTime for sync
 * - This ensures consistent timing across streaming chunks where currentTime resets
 * - Adds 0.1s initial offset so text begins slightly before audio
 * - Listens to 'play' event to set start timestamp immediately
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface UseTextSyncOptions {
  fullText: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  playbackRate?: number;
  wordsPerSecond?: number; // default 3.0 (increased from 2.5 for better sync)
  onUpdate?: (state: TextSyncState) => void;
}

export interface TextSyncState {
  visibleText: string;
  currentWordIndex: number;
  progress: number; // 0..1
  isSynced: boolean;
}

/**
 * Hook for progressive text reveal synchronized with audio playback.
 *
 * @param opts.fullText - The complete text to reveal
 * @param opts.audioElementGetter - Function that returns the current HTMLAudioElement (getter pattern for dynamic ref)
 * @param opts.playbackRate - Audio playback rate (default: 1.0)
 * @param opts.wordsPerSecond - Base words per second rate (default: 3.0)
 * @param opts.onUpdate - Callback when state changes
 */
export function useTextSync(opts: UseTextSyncOptions): TextSyncState & {
  reset: () => void;
  forceSync: () => void;
} {
  const { fullText, audioElementGetter, playbackRate = 1.0, wordsPerSecond = 2.5, onUpdate } = opts;

  const [visibleText, setVisibleText] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isSynced, setIsSynced] = useState(false);

  // Refs for tracking audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastWordIndexRef = useRef(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null); // Track actual audio element we've attached listeners to

  // Split text into words once - memoize to avoid re-computation
  const words = useMemo(() => {
    return fullText.trim() ? fullText.trim().split(/\s+/) : [];
  }, [fullText]);

  // Reset state when fullText changes
  useEffect(() => {
    setVisibleText('');
    setCurrentWordIndex(0);
    setProgress(0);
    setIsSynced(false);
    lastWordIndexRef.current = 0;
    startTimeRef.current = null;
  }, [fullText]);

  // Reset function
  const reset = useCallback(() => {
    setVisibleText('');
    setCurrentWordIndex(0);
    setProgress(0);
    setIsSynced(false);
    lastWordIndexRef.current = 0;
    startTimeRef.current = null;

    // Cancel any ongoing RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Force sync function (for repeat)
  const forceSync = useCallback(() => {
    reset();
    // If audio is already playing, the effect will handle syncing
  }, [reset]);

  // Sync with audio element - uses wall-clock timing for consistent sync across streaming chunks
  // Uses getter pattern to support dynamic audio element refs
  useEffect(() => {
    // Handler for 'play' event - sets start timestamp immediately when playback begins
    const handlePlay = (): void => {
      // Only set start time if not already set (first play or after complete reset)
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
    };

    // Handler for 'ended' event - shows full text when audio completes
    const handleEnded = (): void => {
      const wordCount = words.length;
      setVisibleText(fullText);
      setCurrentWordIndex(wordCount);
      setProgress(1);
      setIsSynced(true);
      lastWordIndexRef.current = wordCount;

      if (onUpdate) {
        onUpdate({
          visibleText: fullText,
          currentWordIndex: wordCount,
          progress: 1,
          isSynced: true,
        });
      }
    };

    // Function to attach event listeners to an audio element
    const attachListeners = (audio: HTMLAudioElement): void => {
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('ended', handleEnded);
    };

    // Function to detach event listeners from an audio element
    const detachListeners = (audio: HTMLAudioElement): void => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
    };

    const updateSync = (): void => {
      // Get current audio element from getter, fallback to previously tracked element
      const audioFromGetter = audioElementGetter?.() ?? null;
      const currentAudio = audioFromGetter ?? currentAudioRef.current;

      // Detect audio element changes - attach/detach listeners as needed
      if (currentAudio !== currentAudioRef.current) {
        // Detach listeners from old element
        if (currentAudioRef.current) {
          detachListeners(currentAudioRef.current);
        }
        // Attach to new element
        if (currentAudio) {
          attachListeners(currentAudio);
        }
        currentAudioRef.current = currentAudio;
      }

      // If no audio element available, just continue the RAF loop without updating
      if (!currentAudio) {
        rafIdRef.current = requestAnimationFrame(updateSync);
        return;
      }

      // Update audioRef for this frame
      audioRef.current = currentAudio;

      const audio = audioRef.current;

      // Check if audio is playing
      if (audio.paused || audio.ended) {
        // Audio not playing - if ended, show full text
        if (audio.ended) {
          const wordCount = words.length;
          setVisibleText(fullText);
          setCurrentWordIndex(wordCount);
          setProgress(1);
          setIsSynced(true);
          lastWordIndexRef.current = wordCount;

          if (onUpdate) {
            onUpdate({
              visibleText: fullText,
              currentWordIndex: wordCount,
              progress: 1,
              isSynced: true,
            });
          }
          // Continue RAF loop even after ended
          rafIdRef.current = requestAnimationFrame(updateSync);
          return;
        } else {
          // Paused - keep current state, just continue loop
          rafIdRef.current = requestAnimationFrame(updateSync);
          return;
        }
      }

      // Calculate elapsed time using wall-clock (Date.now())
      // This is critical for streaming mode where audio.currentTime resets per chunk
      // The startTimeRef is set on 'play' event, not in the RAF loop
      let elapsed = 0;
      if (startTimeRef.current !== null) {
        // Wall-clock elapsed time + 0.1s initial offset
        // Offset ensures text begins slightly before audio for better sync perception
        elapsed = (Date.now() - startTimeRef.current) / 1000 + 0.1;
      }

      // Calculate effective words per second (base rate * playback rate)
      const effectiveWPS = wordsPerSecond * playbackRate;
      const estimatedWordIndex = Math.floor(elapsed * effectiveWPS);
      const clampedIndex = Math.min(Math.max(0, estimatedWordIndex), words.length);

      // Only update if word index changed (throttle updates)
      if (clampedIndex !== lastWordIndexRef.current) {
        lastWordIndexRef.current = clampedIndex;
        setCurrentWordIndex(clampedIndex);

        // Build visible text
        if (clampedIndex === 0) {
          setVisibleText('');
        } else if (clampedIndex >= words.length) {
          setVisibleText(fullText);
          setIsSynced(true);
        } else {
          // Show partial text with trailing indicator
          setVisibleText(words.slice(0, clampedIndex).join(' ') + '...');
        }

        // Update progress
        const progressValue = clampedIndex / words.length;
        setProgress(progressValue);

        if (onUpdate) {
          onUpdate({
            visibleText:
              clampedIndex >= words.length
                ? fullText
                : words.slice(0, clampedIndex).join(' ') +
                  (clampedIndex < words.length ? '...' : ''),
            currentWordIndex: clampedIndex,
            progress: progressValue,
            isSynced: clampedIndex >= words.length,
          });
        }
      }

      // Continue RAF loop
      rafIdRef.current = requestAnimationFrame(updateSync);
    };

    // Start RAF loop immediately on mount
    rafIdRef.current = requestAnimationFrame(updateSync);

    // Cleanup
    return (): void => {
      // Cancel RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Detach listeners from current audio element
      if (currentAudioRef.current) {
        detachListeners(currentAudioRef.current);
      }
    };
  }, [audioElementGetter, wordsPerSecond, playbackRate, fullText, words, onUpdate]);

  return {
    visibleText,
    currentWordIndex,
    progress,
    isSynced,
    reset,
    forceSync,
  };
}
