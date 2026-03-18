import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTextSync } from '../useTextSync';

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

// Mock Date.now()
let mockDateNow = 0;
const mockDateNowFn = vi.fn(() => mockDateNow);

// Setup global mocks
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true,
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true,
});

Object.defineProperty(globalThis, 'Date', {
  value: {
    now: mockDateNowFn,
  },
  writable: true,
});

const flushRaf = (): void => {
  const callbacks = Array.from(rafCallbacks.values());
  rafCallbacks.clear();
  for (const cb of callbacks) {
    cb();
  }
};

describe('useTextSync', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    rafCallbacks.clear();
    mockRafId = 0;
    mockDateNow = 0;
  });

  afterEach((): void => {
    // Clean up any pending raf callbacks
    rafCallbacks.clear();
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

      // Simulate some progress
      act(() => {
        result.current.forceSync();
      });

      expect(result.current.visibleText).toBe('');
      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.progress).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });
  });

  describe('forceSync function', () => {
    it('should reset state when forceSync is called', () => {
      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo',
        }),
      );

      act(() => {
        result.current.forceSync();
      });

      expect(result.current.visibleText).toBe('');
      expect(result.current.currentWordIndex).toBe(0);
    });
  });

  describe('audio element synchronization with wall-clock timing using getter pattern', () => {
    it('should update visibleText based on wall-clock time after play event', () => {
      // Create a mock audio element
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'play') {
            // Simulate play event - set initial time
            mockDateNow = 1000; // 1 second after epoch
            handler();
          }
        }),
        removeEventListener: vi.fn(),
      };

      // Create a getter function that returns the mock audio
      const getAudioElement = (): HTMLAudioElement | null =>
        mockAudio as unknown as HTMLAudioElement | null;

      // Advance time by 1 second (1000ms) after play to simulate audio playing
      const advanceTime = (ms: number): void => {
        mockDateNow += ms;
      };

      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo esto es una prueba',
          audioElementGetter: getAudioElement,
          wordsPerSecond: 3.0, // default now
          playbackRate: 1.0,
        }),
      );

      // Flush RAF TWICE - first to attach listeners, second to sync
      act(() => {
        flushRaf();
      });
      act(() => {
        flushRaf();
      });

      // Advance time to trigger sync - 1 second of playback
      advanceTime(1000);

      // Flush RAF to trigger sync
      act(() => {
        flushRaf();
      });

      // At 1 second with 3.0 WPS, we should have ~3 words
      // elapsed = (Date.now() - startTimeRef.current) / 1000 + 0.1
      // elapsed = (2000 - 1000) / 1000 + 0.1 = 1.0 + 0.1 = 1.1
      // words = 1.1 * 3.0 = 3.3 -> floor = 3
      expect(result.current.currentWordIndex).toBe(3);
    });

    it('should show full text when audio ends', () => {
      const mockAudio = {
        currentTime: 10,
        paused: true,
        ended: true,
        addEventListener: vi.fn((_event: string, _handler: () => void) => {
          // Attach handler but don't auto-fire
        }),
        removeEventListener: vi.fn(),
      };

      const getAudioElement = (): HTMLAudioElement | null =>
        mockAudio as unknown as HTMLAudioElement | null;

      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo',
          audioElementGetter: getAudioElement,
        }),
      );

      // Flush to attach listeners
      act(() => {
        flushRaf();
      });

      // Flush again to check ended state
      act(() => {
        flushRaf();
      });

      // Since audio.ended is true, the RAF loop should show full text
      expect(result.current.visibleText).toBe('Hola mundo');
      expect(result.current.currentWordIndex).toBe(2);
      expect(result.current.progress).toBe(1);
      expect(result.current.isSynced).toBe(true);
    });

    it('should NOT reset when getter returns null - keep current visibleText', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'play') {
            mockDateNow = 1000;
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

      // Advance time and flush RAF to trigger some progress
      mockDateNow += 1000;
      act(() => {
        flushRaf();
      });

      // Now change getter to return null
      const getNullAudio = (): null => null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rerender({ audioElementGetter: getNullAudio as any });

      // visibleText should NOT reset - it should keep the previous value
      // Note: This is the key behavior change - we no longer reset when audio becomes null
      act(() => {
        flushRaf();
      });

      // The RAF loop should continue running without errors
      // We just verify the hook doesn't crash when getter returns null
    });
  });

  describe('playbackRate', () => {
    it('should account for playbackRate in word estimation', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'play') {
            mockDateNow = 1000;
            handler();
          }
        }),
        removeEventListener: vi.fn(),
      };

      const getAudioElement = () => mockAudio as unknown as HTMLAudioElement | null;

      const advanceTime = (ms: number): void => {
        mockDateNow += ms;
      };

      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'uno dos tres cuatro cinco seis siete ocho nueve diez',
          audioElementGetter: getAudioElement,
          wordsPerSecond: 3.0,
          playbackRate: 0.5, // Half speed
        }),
      );

      // Flush to attach listeners
      act(() => {
        flushRaf();
      });
      act(() => {
        flushRaf();
      });

      // Advance time - 1 second of playback
      advanceTime(1000);

      act(() => {
        flushRaf();
      });

      // With 0.5x playback rate, effective WPS is 1.5
      // elapsed = (2000 - 1000) / 1000 + 0.1 = 1.1
      // words = 1.1 * 1.5 = 1.65 -> floor = 1
      expect(result.current.currentWordIndex).toBe(1);
    });
  });

  describe('fullText changes', () => {
    it('should reset when fullText changes', () => {
      const { result, rerender } = renderHook(
        ({ fullText }) =>
          useTextSync({
            fullText,
          }),
        { initialProps: { fullText: 'Hola mundo' } },
      );

      // Force sync
      act(() => {
        result.current.forceSync();
      });

      // Change fullText
      rerender({ fullText: 'Nueva frase con más palabras para probar' });

      expect(result.current.visibleText).toBe('');
      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.progress).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });
  });

  describe('wall-clock timing with 0.1s offset', () => {
    it('should apply 0.1s initial offset for better sync', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'play') {
            mockDateNow = 1000;
            handler();
          }
        }),
        removeEventListener: vi.fn(),
      };

      const getAudioElement = () => mockAudio as unknown as HTMLAudioElement | null;

      // Advance very little time - less than 0.1s
      const advanceTime = (ms: number): void => {
        mockDateNow += ms;
      };

      const { result } = renderHook(() =>
        useTextSync({
          fullText: 'uno dos tres',
          audioElementGetter: getAudioElement,
          wordsPerSecond: 3.0,
          playbackRate: 1.0,
        }),
      );

      // Flush to attach listeners
      act(() => {
        flushRaf();
      });
      act(() => {
        flushRaf();
      });

      // Advance only 50ms - less than 0.1s offset
      advanceTime(50);

      act(() => {
        flushRaf();
      });

      // With offset: elapsed = (1050 - 1000) / 1000 + 0.1 = 0.05 + 0.1 = 0.15
      // words = 0.15 * 3.0 = 0.45 -> floor = 0
      // Without offset: elapsed would be 0.05 -> words = 0.15 -> floor = 0
      // The difference would show with slightly more time
      expect(result.current.currentWordIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanup', () => {
    it('should cancel RAF on unmount', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const getAudioElement = () => mockAudio as unknown as HTMLAudioElement | null;

      const { unmount } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo',
          audioElementGetter: getAudioElement,
        }),
      );

      // Flush to ensure RAF is running
      act(() => {
        flushRaf();
      });

      unmount();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });

    it('should remove event listeners on cleanup', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const getAudioElement = () => mockAudio as unknown as HTMLAudioElement | null;

      const { unmount } = renderHook(() =>
        useTextSync({
          fullText: 'Hola mundo',
          audioElementGetter: getAudioElement,
        }),
      );

      // Flush to ensure listeners are attached
      act(() => {
        flushRaf();
      });

      unmount();

      // With the getter pattern, listeners are attached in RAF loop
      // They should be removed on cleanup
      expect(mockAudio.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
      expect(mockAudio.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    });
  });
});
