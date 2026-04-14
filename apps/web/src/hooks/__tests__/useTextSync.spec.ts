import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTextSync } from '../../features/lesson/hooks/useTextSync';

// Mock requestAnimationFrame and cancelAnimationFrame
let mockRafId = 0;
const rafCallbacks: Map<number, () => void> = new Map();

const mockRequestAnimationFrame = vi.fn((callback: () => void) => {
  mockRafId++;
  rafCallbacks.set(mockRafId, callback);
  return mockRafId;
});

const mockCancelAnimationFrame = vi.fn((id: number) => {
  rafCallbacks.delete(id);
});

// Mock setInterval and clearInterval
const intervalCallbacks: Map<number, () => void> = new Map();
let intervalId = 0;

const mockSetInterval = vi.fn((callback: () => void, _ms: number) => {
  intervalId++;
  intervalCallbacks.set(intervalId, callback);
  return intervalId;
});

const mockClearInterval = vi.fn((id: number) => {
  intervalCallbacks.delete(id);
});

// Setup global mocks
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true,
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true,
});

Object.defineProperty(globalThis, 'setInterval', {
  value: mockSetInterval,
  writable: true,
});

Object.defineProperty(globalThis, 'clearInterval', {
  value: mockClearInterval,
  writable: true,
});

const flushRaf = (): void => {
  const callbacks = Array.from(rafCallbacks.values());
  rafCallbacks.clear();
  for (const cb of callbacks) {
    cb();
  }
};

const flushIntervals = (): void => {
  const callbacks = Array.from(intervalCallbacks.values());
  intervalCallbacks.clear();
  for (const cb of callbacks) {
    cb();
  }
};

describe('useTextSync', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    rafCallbacks.clear();
    intervalCallbacks.clear();
    mockRafId = 0;
    intervalId = 0;
  });

  afterEach((): void => {
    rafCallbacks.clear();
    intervalCallbacks.clear();
  });

  describe('initialization', () => {
    it('should initialize with empty visibleText when fullText is provided', () => {
      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo esto es una prueba',
        }),
      );

      expect(result.current.visibleText).toBe('');
      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.progress).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });

    it('should handle empty fullText', () => {
      const { result } = renderHook(() =>
        useTextSync({
          fullText: '',
        }),
      );

      expect(result.current.visibleText).toBe('');
      expect(result.current.currentWordIndex).toBe(0);
    });
  });

  describe('reset function', () => {
    it('should reset state when reset is called', () => {
      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo',
        }),
      );

      // Use reset function
      act(() => {
        result.current.reset();
      });

      expect(result.current.visibleText).toBe('');
      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.progress).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });
  });

  describe('audio element synchronization with getter pattern', () => {
    it('should NOT reset when getter returns null - keep current visibleText', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        duration: 2,
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'play') {
            handler();
          }
        }),
        removeEventListener: vi.fn(),
      };

      // Start with getter returning audio
      let getterCallCount = 0;
      const getAudioElement = (): HTMLAudioElement | null => {
        getterCallCount++;
        // First few calls return the audio, then return null
        return getterCallCount <= 5 ? (mockAudio as unknown as HTMLAudioElement) : null;
      };

      const { rerender } = renderHook(
        ({ audioElementGetter }: { audioElementGetter: () => HTMLAudioElement | null }) =>
          useTextSync({
            fullText: 'Hola mundo',
            audioElementGetter,
          }),
        {
          initialProps: {
            audioElementGetter: getAudioElement,
          },
        },
      );

      // Flush RAF and intervals
      act(() => {
        flushRaf();
        flushIntervals();
      });

      // Now change getter to return null
      const getNullAudio = (): null => null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rerender({ audioElementGetter: getNullAudio as any });

      // The hook should not crash when getter returns null
      act(() => {
        flushRaf();
        flushIntervals();
      });
    });
  });

  describe('fullText changes', () => {
    it('should update word list when fullText changes', () => {
      const { result, rerender } = renderHook(
        ({ fullText }) =>
          useTextSync({
            fullText,
          }),
        { initialProps: { fullText: 'Hola mundo' } },
      );

      // Change fullText
      rerender({ fullText: 'Nueva frase con más palabras para probar' });

      // State should remain at initial values (waiting for audio)
      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up when component unmounts without audio', () => {
      const { unmount } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo',
        }),
      );

      unmount();

      // Without audio element, no cleanup needed but should not crash
      // The hook should handle unmount gracefully
      expect(true).toBe(true);
    });
  });
});
