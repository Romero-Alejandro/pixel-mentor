/**
 * computeChunkWordSpans Tests
 *
 * Pure allocation logic used by useTextSync to map streamed TTS chunks
 * (byte sizes proportional to spoken duration) to word spans.
 */

import { describe, it, expect, afterEach } from 'vitest';

import {
  computeChunkWordSpans,
  computeChunkWordSpansFromTexts,
  calculateWordIndexWithPauses,
  isKaraokeDebugEnabled,
} from '../useTextSync';

describe('computeChunkWordSpans', () => {
  it('should allocate all words to a single chunk', () => {
    expect(computeChunkWordSpans([1000], 60)).toEqual([60]);
  });

  it('should split proportionally to byte weights', () => {
    // 1:3 ratio over 60 words -> 15 / 45
    expect(computeChunkWordSpans([1000, 3000], 60)).toEqual([15, 45]);
  });

  it('should conserve the total with largest-remainder rounding', () => {
    // 1:1:1 over 10 words -> 4 / 3 / 3 (sum exactly 10)
    const spans = computeChunkWordSpans([100, 100, 100], 10);
    expect(spans.reduce((a, b) => a + b, 0)).toBe(10);
    expect(spans).toEqual([4, 3, 3]);
  });

  it('should give zero words to empty chunks without breaking the total', () => {
    const spans = computeChunkWordSpans([0, 2000], 20);
    expect(spans).toEqual([0, 20]);
  });

  it('should split equally when all weights are zero', () => {
    const spans = computeChunkWordSpans([0, 0], 10);
    expect(spans).toEqual([5, 5]);
  });

  it('should return zeros when there are no words', () => {
    expect(computeChunkWordSpans([500, 700], 0)).toEqual([0, 0]);
  });

  it('should return an empty array when there are no chunks', () => {
    expect(computeChunkWordSpans([], 30)).toEqual([]);
  });

  it('should never produce negative spans', () => {
    const spans = computeChunkWordSpans([-50, 1000], 12);
    expect(spans.every((s) => s >= 0)).toBe(true);
    expect(spans.reduce((a, b) => a + b, 0)).toBe(12);
  });
});

describe('computeChunkWordSpansFromTexts', () => {
  it('should return exact counts when chunks cover the whole text', () => {
    expect(computeChunkWordSpansFromTexts(['Hola mundo', 'cómo estás hoy'], 5)).toEqual([2, 3]);
  });

  it('should return null when a chunk text is missing (legacy server)', () => {
    expect(computeChunkWordSpansFromTexts(['Hola mundo', undefined], 5)).toBeNull();
  });

  it('should return null when counts do not add up to the total', () => {
    expect(computeChunkWordSpansFromTexts(['Hola mundo', 'adiós'], 6)).toBeNull();
  });

  it('should return null for empty input', () => {
    expect(computeChunkWordSpansFromTexts([], 5)).toBeNull();
    expect(computeChunkWordSpansFromTexts(['hola'], 0)).toBeNull();
  });

  it('should tolerate surrounding whitespace in chunk texts', () => {
    expect(computeChunkWordSpansFromTexts(['  Hola mundo ', ' adiós'], 3)).toEqual([2, 1]);
  });
});

describe('calculateWordIndexWithPauses', () => {
  it('should map time linearly when there is no punctuation', () => {
    const words = ['Hola', 'mundo'];
    expect(calculateWordIndexWithPauses(0, 2, words)).toBe(0);
    expect(calculateWordIndexWithPauses(0.5, 2, words)).toBe(0);
    expect(calculateWordIndexWithPauses(1.5, 2, words)).toBe(1);
    expect(calculateWordIndexWithPauses(5, 2, words)).toBe(1);
  });

  it('should hold the index during sentence pauses', () => {
    // 'Hola.' carries a 0.35s pause: timeForWords = 1.65 over 10 chars.
    // Word 0 spans [0, 0.825), then pause until 1.175.
    const words = ['Hola.', 'mundo'];
    expect(calculateWordIndexWithPauses(0.5, 2, words)).toBe(0);
    expect(calculateWordIndexWithPauses(1, 2, words)).toBe(1);
    expect(calculateWordIndexWithPauses(1.1, 2, words)).toBe(1);
  });

  it('should fall back to linear mapping when pauses exceed the duration', () => {
    const words = ['A.', 'B.'];
    expect(calculateWordIndexWithPauses(0.1, 0.5, words)).toBe(0);
    expect(calculateWordIndexWithPauses(0.3, 0.5, words)).toBe(1);
  });

  it('should handle degenerate inputs', () => {
    expect(calculateWordIndexWithPauses(1, 2, [])).toBe(0);
    expect(calculateWordIndexWithPauses(1, 0, ['hola'])).toBe(0);
  });
});

describe('isKaraokeDebugEnabled', () => {
  afterEach(() => {
    window.localStorage.removeItem('karaoke-debug');
    window.history.replaceState(null, '', '/');
  });

  it('should be off by default', () => {
    expect(isKaraokeDebugEnabled()).toBe(false);
  });

  it('should turn on via URL param', () => {
    window.history.replaceState(null, '', '/?karaoke-debug');
    expect(isKaraokeDebugEnabled()).toBe(true);
  });

  it('should turn on via localStorage flag', () => {
    window.localStorage.setItem('karaoke-debug', '1');
    expect(isKaraokeDebugEnabled()).toBe(true);
  });
});
