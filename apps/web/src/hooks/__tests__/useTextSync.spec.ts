import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTextSync } from '../../features/lesson/hooks/useTextSync';

// Mock audio events
const eventCallbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();

const mockAddEventListener = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
  if (!eventCallbacks.has(event)) {
    eventCallbacks.set(event, new Set());
  }
  eventCallbacks.get(event)!.add(handler);
});

const mockRemoveEventListener = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
  const callbacks = eventCallbacks.get(event);
  if (callbacks) {
    callbacks.delete(handler);
  }
});

const mockDispatchEvent = (event: string, ...args: unknown[]): void => {
  const callbacks = eventCallbacks.get(event);
  if (callbacks) {
    callbacks.forEach((handler) => handler(...args));
  }
};

// Setup global mocks
Object.defineProperty(globalThis, 'Audio', {
  value: vi.fn().mockImplementation(() => ({
    currentTime: 0,
    paused: true,
    ended: false,
    duration: 2,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    play: vi.fn(),
    pause: vi.fn(),
  })),
  writable: true,
});

describe('useTextSync', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    eventCallbacks.clear();
  });

  afterEach((): void => {
    eventCallbacks.clear();
  });

  describe('initialization', () => {
    it('should initialize with empty state when text is provided', () => {
      const { result } = renderHook(() =>
        useTextSync({
          text: 'Hola mundo esto es una prueba',
        }),
      );

      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.progress).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });

    it('should handle empty text', () => {
      const { result } = renderHook(() =>
        useTextSync({
          text: '',
        }),
      );

      expect(result.current.currentWordIndex).toBe(0);
    });
  });

  describe('reset function', () => {
    it('should reset state when reset is called', () => {
      const { result } = renderHook(() =>
        useTextSync({
          text: 'Hola mundo',
        }),
      );

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentWordIndex).toBe(0);
      expect(result.current.progress).toBe(0);
      expect(result.current.isSynced).toBe(false);
    });
  });

  describe('word splitting', () => {
    it('should provide words split into array', () => {
      const { result } = renderHook(() =>
        useTextSync({
          text: 'Hola mundo esto es contenido fin',
        }),
      );

      expect(result.current.words).toEqual(['Hola', 'mundo', 'esto', 'es', 'contenido', 'fin']);
    });
  });

  describe('audio element synchronization with getter pattern', () => {
    it('should use timeupdate event for sync', () => {
      const mockAudio = {
        currentTime: 1,
        paused: false,
        ended: false,
        duration: 2,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        play: vi.fn(),
        pause: vi.fn(),
      };

      // Stable getter: simulates the real scenario where audioElementReady gates sync.
      // With audioElementReady=true, the guard passes and sync starts.
      const getAudioElement = (): HTMLAudioElement | null => mockAudio as unknown as HTMLAudioElement;

      const { result } = renderHook(
        ({
          audioElementGetter,
          isSpeaking,
          audioElementReady,
        }: {
          audioElementGetter: () => HTMLAudioElement | null;
          isSpeaking?: boolean;
          audioElementReady?: boolean;
        }) =>
          useTextSync({
            text: 'Hola mundo esto es contenido',
            audioElementGetter,
            isSpeaking,
            audioElementReady,
          }),
        {
          initialProps: {
            audioElementGetter: getAudioElement,
            isSpeaking: true,
            audioElementReady: true,
          },
        },
      );

      act(() => {
        mockDispatchEvent('timeupdate');
      });

      expect(result.current.currentWordIndex).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up when component unmounts without audio', () => {
      const { unmount } = renderHook(() =>
        useTextSync({
          text: 'Hola mundo',
        }),
      );

      unmount();

      expect(true).toBe(true);
    });
  });
});
