import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import type { AudioSyncInfo } from '@/features/voice/hooks/use-voice';
import { logger } from '@/utils/logger';

export interface UseTextSyncOptions {
  text: string;
  audioElementGetter?: () => HTMLAudioElement | null;
  /**
   * Chunk-aware sync snapshot from streaming TTS. When provided (and
   * non-null), word indices are mapped per sounding chunk; when absent,
   * the legacy single-element full-text mapping is used.
   */
  syncInfoGetter?: () => AudioSyncInfo | null;
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
  /** Explicit sync lifecycle for diagnostics (Phase 0 observability). */
  phase: SyncPhase;
  /** Last transition reason (e.g. 'chunk-2', 'no-audio-element'). */
  detail: string;
}

/**
 * Explicit karaoke sync lifecycle (Phase 0 observability).
 * - idle: nothing to sync (no speech yet or after reset).
 * - attaching: speech started, waiting for / binding the audio element.
 * - syncing: word indices are being computed from a live element.
 * - degraded: sync cannot proceed (no element, element error) — UI falls back.
 * - done: final chunk ended, text fully highlighted.
 */
export type SyncPhase = 'idle' | 'attaching' | 'syncing' | 'degraded' | 'done';

/** Debug overlay flag: `?karaoke-debug` in URL or localStorage `karaoke-debug=1`. */
export function isKaraokeDebugEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      if (new URLSearchParams(window.location.search).has('karaoke-debug')) return true;
      if (window.localStorage?.getItem('karaoke-debug') === '1') return true;
    }
  } catch {
    // Storage/URL access can throw in restricted contexts — debug stays off.
  }
  return false;
}

const MAX_AUDIO_DURATION = 300;

// ~64kbps MP3 fallback rate used to estimate a chunk's duration from its
// byte size while its metadata hasn't loaded yet.
const DEFAULT_BYTES_PER_SECOND = 8000;

/**
 * Lead (seconds) added to the element clock before mapping to words.
 * `timeupdate` events lag reality by up to ~250ms, so the computed index
 * systematically trails the voice; a small lead compensates it. Karaoke
 * convention also favors painting a word a fraction before it sounds.
 */
export const SYNC_LEAD_SECONDS = 0.12;

/** Pause after sentence-final punctuation (seconds). */
const PAUSE_AFTER_SENTENCE_SECONDS = 0.35;
/** Pause after clause punctuation (seconds). */
const PAUSE_AFTER_CLAUSE_SECONDS = 0.18;

function pauseAfterWord(word: string): number {
  const last = word.charAt(word.length - 1);
  if (last === '.' || last === '!' || last === '?' || last === '…') {
    return PAUSE_AFTER_SENTENCE_SECONDS;
  }
  if (last === ',' || last === ';' || last === ':') {
    return PAUSE_AFTER_CLAUSE_SECONDS;
  }
  return 0;
}

/**
 * Word index for a playback time, modeling punctuation pauses explicitly.
 * Pause budgets are subtracted first; remaining time is distributed by word
 * length. Falls back to plain linear mapping when pauses don't fit.
 */
export function calculateWordIndexWithPauses(
  currentTime: number,
  audioDuration: number,
  words: string[],
): number {
  if (words.length === 0 || audioDuration <= 0) return 0;
  const t = Math.max(0, currentTime + SYNC_LEAD_SECONDS);
  const totalChars = words.reduce((sum, word) => sum + word.length, 0);
  const totalPause = words.reduce((sum, word) => sum + pauseAfterWord(word), 0);
  const timeForWords = audioDuration - totalPause;
  if (totalChars === 0 || timeForWords <= 0) {
    const timePerWord = audioDuration / words.length;
    return Math.min(Math.floor(t / timePerWord), words.length - 1);
  }
  const timePerChar = timeForWords / totalChars;
  let accumulatedTime = 0;
  for (let i = 0; i < words.length; i++) {
    const wordDuration = words[i].length * timePerChar;
    if (t < accumulatedTime + wordDuration) {
      return i;
    }
    accumulatedTime += wordDuration + pauseAfterWord(words[i]);
  }
  return words.length - 1;
}

function isValidDuration(d: number): boolean {
  return typeof d === 'number' && Number.isFinite(d) && d > 0.1 && d < MAX_AUDIO_DURATION;
}

/**
 * Splits `totalWords` across streamed chunks proportionally to `weights`
 * (chunk byte sizes are proportional to spoken duration). Largest-remainder
 * allocation: spans are non-negative integers summing to exactly `totalWords`.
 */
export function computeChunkWordSpans(weights: number[], totalWords: number): number[] {
  const spans = new Array<number>(weights.length).fill(0);
  if (weights.length === 0 || totalWords <= 0) return spans;
  const positive = weights.map((w) => (w > 0 ? w : 0));
  const totalWeight = positive.reduce((a, b) => a + b, 0);
  const raw = positive.map((w) =>
    totalWeight > 0 ? (w / totalWeight) * totalWords : totalWords / weights.length,
  );
  const floors = raw.map((r) => Math.floor(r));
  for (let i = 0; i < spans.length; i++) spans[i] = floors[i];
  let remainder = totalWords - floors.reduce((a, b) => a + b, 0);
  const byFraction = raw.map((_, i) => i).sort((a, b) => raw[b] - floors[b] - (raw[a] - floors[a]));
  for (let k = 0; remainder > 0 && k < byFraction.length; k++) {
    spans[byFraction[k]] += 1;
    remainder -= 1;
  }
  return spans;
}

/**
 * Exact word spans from server-annotated chunk texts. The backend splits the
 * utterance contiguously, so chunk word counts must add up to the total;
 * returns null on any mismatch (or missing annotation) so callers fall back
 * to byte-proportional spans instead of highlighting wrong words.
 */
export function computeChunkWordSpansFromTexts(
  chunkTexts: Array<string | undefined>,
  totalWords: number,
): number[] | null {
  if (chunkTexts.length === 0 || totalWords <= 0) return null;
  const counts: number[] = [];
  for (const t of chunkTexts) {
    if (typeof t !== 'string') return null;
    const trimmed = t.trim();
    counts.push(trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length);
  }
  const sum = counts.reduce((a, b) => a + b, 0);
  return sum === totalWords ? counts : null;
}

/** Estimate a chunk's duration from byte sizes when metadata isn't loaded yet. */
function estimateChunkDuration(
  bytes: number,
  chunks: Array<{ bytes: number; duration: number | null }>,
): number | null {
  if (bytes <= 0) return null;
  let knownBytes = 0;
  let knownSecs = 0;
  for (const c of chunks) {
    if (c.duration !== null && c.duration > 0) {
      knownBytes += c.bytes;
      knownSecs += c.duration;
    }
  }
  const rate = knownSecs > 0 ? knownBytes / knownSecs : DEFAULT_BYTES_PER_SECOND;
  if (!(rate > 0)) return null;
  return bytes / rate;
}

/**
 * Custom hook for synchronizing text highlighting with audio playback.
 * Uses timeupdate event as single source of truth for state updates.
 */
export function useTextSync({
  text,
  audioElementGetter,
  syncInfoGetter,
  isSpeaking,
  audioElementReady = true,
}: UseTextSyncOptions): {
  currentWordIndex: number;
  progress: number;
  isSynced: boolean;
  syncError: boolean;
  isAttemptingSync: boolean;
  syncPhase: SyncPhase;
  syncDetail: string;
  words: string[];
  reset: () => void;
} {
  const [state, setState] = useState<SyncState>({
    currentWordIndex: 0,
    progress: 0,
    isSynced: false,
    syncError: false,
    isAttemptingSync: false,
    phase: 'idle',
    detail: 'init',
  });

  // Phase mirror to avoid redundant updates; transitions log only when enabled.
  const phaseRef = useRef<SyncPhase>('idle');
  const detailRef = useRef<string>('init');

  const setPhase = (phase: SyncPhase, detail: string): void => {
    if (phaseRef.current === phase && detailRef.current === detail) return;
    phaseRef.current = phase;
    detailRef.current = detail;
    if (isKaraokeDebugEnabled()) {
      logger.debug('[TextSync]', phase, detail);
    }
    setState((prev) =>
      prev.phase === phase && prev.detail === detail ? prev : { ...prev, phase, detail },
    );
  };

  const words = useMemo(() => {
    if (!text.trim()) return [];
    // Always split by words for karaoke highlighting
    return text.trim().split(/\s+/);
  }, [text]);
  const totalWordCount = words.length;

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const prevSpeakingRef = useRef<boolean | undefined>(undefined);
  const isListeningRef = useRef(false);
  // Element currently carrying our listeners (rotates as streamed chunks advance)
  const attachedElementRef = useRef<HTMLAudioElement | null>(null);
  // Latest "ensure listeners on the live element" routine (assigned by the main effect)
  const ensureAttachedRef = useRef<() => void>(() => {});
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
      setPhase('attaching', 'speaking-started');
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
      if (phaseRef.current === 'attaching' || phaseRef.current === 'degraded') {
        setPhase('idle', 'speaking-stopped');
      }
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
      setPhase('degraded', 'no-audio-element');
      return;
    }

    const handleTimeUpdate = (): void => {
      const info = syncInfoGetter?.() ?? null;
      const currentAudio = getAudioElement();
      if (!currentAudio) return;
      if (currentAudio !== attachedElementRef.current) {
        // Chunk rotation: the sounding element changed — follow it.
        attachToElement(currentAudio);
        return;
      }

      const audioDuration = currentAudio.duration;
      const chunkCount = info?.chunks.length ?? 0;

      // Chunk-aware path (streaming TTS): map time within the sounding
      // chunk to its word span instead of the whole text.
      if (info && chunkCount > 0 && totalWordCount > 0) {
        const idx = Math.min(Math.max(info.chunkIndex, 0), chunkCount - 1);
        // Exact spans when the server annotates chunk texts; byte-proportional
        // fallback for legacy servers (marked with ~ in the debug detail).
        const exact = computeChunkWordSpansFromTexts(
          info.chunks.map((c) => c.text),
          totalWordCount,
        );
        const spans =
          exact ??
          computeChunkWordSpans(
            info.chunks.map((c) => c.bytes),
            totalWordCount,
          );
        const span = spans[idx];
        const offset = spans.slice(0, idx).reduce((a, b) => a + b, 0);
        if (span <= 0) return;
        let effective: number | null = isValidDuration(audioDuration) ? audioDuration : null;
        if (effective === null) {
          // Chunk metadata not loaded yet — estimate instead of giving up.
          const est = estimateChunkDuration(info.chunks[idx].bytes, info.chunks);
          if (est === null || est <= 0) return;
          effective = est;
        }
        const local = calculateWordIndexWithPauses(
          currentAudio.currentTime,
          effective,
          words.slice(offset, offset + span),
        );
        const estimatedIndex = Math.min(offset + local, totalWordCount - 1);
        const spanLabel = `chunk-${idx}[${offset}+${span}]/${chunkCount}${exact ? '' : '~'}`;
        setPhase('syncing', effective === audioDuration ? spanLabel : `${spanLabel}-estimated`);
        setState((prev) => {
          // Speech only moves forward: never let re-estimation jump back.
          const clamped = Math.max(estimatedIndex, prev.currentWordIndex);
          const nowSynced = prev.isSynced || (prev.isAttemptingSync && clamped >= 0);
          return {
            currentWordIndex: clamped,
            progress: clamped / (totalWordCount || 1),
            isSynced: nowSynced,
            syncError: false,
            isAttemptingSync: prev.isAttemptingSync ? !nowSynced : false,
            phase: prev.phase,
            detail: prev.detail,
          };
        });
        return;
      }

      // Legacy single-element path (HTTP / browser TTS).
      // Duration metadata may simply not be ready yet — keep attempting.
      if (!isValidDuration(audioDuration) || totalWordCount === 0) return;

      // Use pause-aware heuristic for more accurate highlighting
      const estimatedIndex = calculateWordIndexWithPauses(
        currentAudio.currentTime,
        audioDuration,
        words,
      );

      setPhase('syncing', 'single-element');
      setState((prev) => {
        const nowSynced = prev.isSynced || (prev.isAttemptingSync && estimatedIndex >= 0);
        return {
          currentWordIndex: estimatedIndex,
          progress: estimatedIndex / (totalWordCount || 1),
          isSynced: nowSynced,
          syncError: false,
          isAttemptingSync: prev.isAttemptingSync ? !nowSynced : false,
          phase: prev.phase,
          detail: prev.detail,
        };
      });
    };

    const handleError = (): void => {
      isListeningRef.current = false;
      attachedElementRef.current = null;
      setPhase('degraded', 'element-error');
      setState((prev) => ({ ...prev, syncError: true, isAttemptingSync: false }));
    };

    const handleEnded = (): void => {
      const info = syncInfoGetter?.() ?? null;
      if (info && info.chunks.length > 0 && !info.isLastChunk) {
        // Intermediate streamed chunk finished: release it and follow the
        // next sounding element instead of declaring the text complete.
        setPhase('attaching', 'chunk-advance');
        detachCurrent();
        const next = getAudioElement();
        if (next) attachToElement(next);
        return;
      }
      isListeningRef.current = false;
      attachedElementRef.current = null;
      phaseRef.current = 'done';
      detailRef.current = 'stream-complete';
      setState({
        currentWordIndex: totalWordCount,
        progress: 1,
        isSynced: true,
        syncError: false,
        isAttemptingSync: false,
        phase: 'done',
        detail: 'stream-complete',
      });
    };

    const detachCurrent = (): void => {
      const attached = attachedElementRef.current;
      if (attached) {
        const tUpdate = handleTimeUpdateRef.current;
        const tEnded = handleEndedRef.current;
        const tError = handleErrorRef.current;
        if (tUpdate) attached.removeEventListener('timeupdate', tUpdate);
        if (tEnded) attached.removeEventListener('ended', tEnded);
        if (tError) attached.removeEventListener('error', tError);
      }
      isListeningRef.current = false;
      attachedElementRef.current = null;
    };

    const attachToElement = (target: HTMLAudioElement): void => {
      detachCurrent();
      handleTimeUpdateRef.current = handleTimeUpdate;
      handleEndedRef.current = handleEnded;
      handleErrorRef.current = handleError;
      target.addEventListener('timeupdate', handleTimeUpdate);
      target.addEventListener('error', handleError);
      target.addEventListener('ended', handleEnded);
      isListeningRef.current = true;
      attachedElementRef.current = target;
    };

    if (isListeningRef.current && attachedElementRef.current === audio) {
      return;
    }

    ensureAttachedRef.current = () => {
      const el = getAudioElement();
      if (el && el !== attachedElementRef.current) attachToElement(el);
    };

    attachToElement(audio);

    return () => {
      detachCurrent();
      handleTimeUpdateRef.current = null;
      handleEndedRef.current = null;
      handleErrorRef.current = null;
    };
  }, [isSpeaking, totalWordCount, getAudioElement, syncInfoGetter, text, audioElementReady]);

  // Backstop: if listeners were released (e.g. a chunk rotation raced the
  // ended handler, or readiness arrived late) while sync is still pending,
  // re-attach to the live element using the main effect's routine.
  useEffect(() => {
    if (state.isAttemptingSync && !state.isSynced && audioElementReady) {
      ensureAttachedRef.current();
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
    attachedElementRef.current = null;
    prevSpeakingRef.current = undefined;
    phaseRef.current = 'idle';
    detailRef.current = 'reset';
    setState({
      currentWordIndex: 0,
      progress: 0,
      isSynced: false,
      syncError: false,
      isAttemptingSync: false,
      phase: 'idle',
      detail: 'reset',
    });
  }, [getAudioElement]);

  return {
    ...state,
    syncPhase: state.phase,
    syncDetail: state.detail,
    words,
    reset,
  };
}
