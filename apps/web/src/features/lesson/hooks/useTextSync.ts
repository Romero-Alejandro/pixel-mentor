import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface UseTextSyncOptions {
  fullText: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  playbackRate?: number;
  wordsPerSecond?: number;
  onUpdate?: (state: TextSyncState) => void;
}

export interface TextSyncState {
  visibleText: string;
  currentWordIndex: number;
  progress: number;
  isSynced: boolean;
}

export function useTextSync({
  fullText,
  audioElementGetter,
  playbackRate = 1.0,
  wordsPerSecond = 2.5,
  onUpdate,
}: UseTextSyncOptions) {
  const [state, setState] = useState<TextSyncState>({
    visibleText: '',
    currentWordIndex: 0,
    progress: 0,
    isSynced: false,
  });

  const rafIdRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const lastWordIndexRef = useRef(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const words = useMemo(() => (fullText.trim() ? fullText.trim().split(/\s+/) : []), [fullText]);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopRaf();
    lastWordIndexRef.current = 0;
    accumulatedTimeRef.current = 0;
    setState({ visibleText: '', currentWordIndex: 0, progress: 0, isSynced: false });
  }, [stopRaf]);

  useEffect(() => {
    reset();
  }, [fullText, reset]);

  const updateSync = useCallback(() => {
    const audio = currentAudioRef.current;
    if (!audio || audio.paused || audio.ended) return;

    const elapsed = accumulatedTimeRef.current + audio.currentTime + 0.1;
    const effectiveWPS = wordsPerSecond * playbackRate;
    const estimatedIndex = Math.min(Math.floor(elapsed * effectiveWPS), words.length);

    if (estimatedIndex !== lastWordIndexRef.current) {
      lastWordIndexRef.current = estimatedIndex;
      const isCompleted = estimatedIndex >= words.length;
      const newText = isCompleted
        ? fullText
        : words.slice(0, estimatedIndex).join(' ') + (estimatedIndex > 0 ? '...' : '');
      const newState = {
        visibleText: newText,
        currentWordIndex: estimatedIndex,
        progress: estimatedIndex / words.length,
        isSynced: isCompleted,
      };

      setState(newState);
      onUpdateRef.current?.(newState);

      if (isCompleted) {
        stopRaf();
        return;
      }
    }
    rafIdRef.current = requestAnimationFrame(updateSync);
  }, [fullText, words, playbackRate, wordsPerSecond, stopRaf]);

  useEffect(() => {
    const handlePlay = () => {
      stopRaf();
      rafIdRef.current = requestAnimationFrame(updateSync);
    };
    const handlePause = () => stopRaf();
    const handleEnded = (e: Event) => {
      accumulatedTimeRef.current += (e.target as HTMLAudioElement).duration || 0;
      stopRaf();
    };

    const interval = setInterval(() => {
      const audio = audioElementGetter?.() || null;
      if (audio !== currentAudioRef.current) {
        if (currentAudioRef.current) {
          currentAudioRef.current.removeEventListener('play', handlePlay);
          currentAudioRef.current.removeEventListener('pause', handlePause);
          currentAudioRef.current.removeEventListener('ended', handleEnded);
        }
        if (audio) {
          audio.addEventListener('play', handlePlay);
          audio.addEventListener('pause', handlePause);
          audio.addEventListener('ended', handleEnded);
          if (!audio.paused) handlePlay();
        }
        currentAudioRef.current = audio;
      }
    }, 200);

    return () => {
      clearInterval(interval);
      stopRaf();
      if (currentAudioRef.current) {
        currentAudioRef.current.removeEventListener('play', handlePlay);
        currentAudioRef.current.removeEventListener('pause', handlePause);
        currentAudioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [audioElementGetter, updateSync, stopRaf]);

  return { ...state, reset, forceSync: reset };
}
