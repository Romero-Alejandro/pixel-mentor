import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useVoiceRecording, useVoicePlayback } from '../../hooks/useVoice';

// Mock SpeechSynthesisUtterance globally for this test file
class MockSpeechSynthesisUtterance {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text?: string) {
    this.text = text ?? '';
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
  }
}

(globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

function createMockSpeechRecognitionInstance() {
  return {
    lang: 'es-ES',
    interimResults: false,
    maxAlternatives: 1,
    continuous: false,
    grammars: null,
    onresult: null as ((event: any) => void) | null,
    onerror: null as ((event: any) => void) | null,
    onend: null as ((event?: any) => void) | null,
    onaudioend: null,
    onaudiostart: null,
    onnomatch: null,
    onsoundend: null,
    onsoundstart: null,
    onspeechend: null,
    onspeechstart: null,
    onstart: null,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
}

describe('useVoiceRecording', () => {
  let mockRecognitionInstance: ReturnType<typeof createMockSpeechRecognitionInstance>;

  beforeEach(() => {
    mockRecognitionInstance = createMockSpeechRecognitionInstance();

    // Mock constructor function
    // @ts-ignore - mocking globals
    globalThis.SpeechRecognition = function () {
      return mockRecognitionInstance;
    } as any;
    // @ts-ignore - mocking globals
    globalThis.webkitSpeechRecognition = function () {
      return mockRecognitionInstance;
    } as any;
  });

  afterEach(() => {
    // @ts-ignore
    delete globalThis.SpeechRecognition;
    // @ts-ignore
    delete globalThis.webkitSpeechRecognition;
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useVoiceRecording());

    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('should set error when speech recognition is not supported', () => {
    // @ts-ignore
    delete globalThis.SpeechRecognition;
    // @ts-ignore
    delete globalThis.webkitSpeechRecognition;

    const { result } = renderHook(() => useVoiceRecording());

    expect(result.current.error).toBe('Speech recognition not supported');
  });

  it('should start recording successfully', () => {
    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should handle start recording error', () => {
    mockRecognitionInstance.start.mockImplementation(() => {
      throw new Error('Already started');
    });

    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.error).toBe('Failed to start recording');
  });

  it('should stop recording successfully', () => {
    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stopRecording();
    });

    expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it('should capture transcript from recognition result', () => {
    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.isListening).toBe(true);

    act(() => {
      if (mockRecognitionInstance.onresult) {
        mockRecognitionInstance.onresult({
          results: {
            0: {
              0: {
                transcript: 'Hello world',
                confidence: 0.9,
              },
            },
            length: 1,
          },
        });
      }
    });

    expect(result.current.transcript).toBe('Hello world');
  });

  it('should handle recognition error', () => {
    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.isListening).toBe(true);

    act(() => {
      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror({ error: 'no-speech' });
      }
    });

    expect(result.current.error).toBe('no-speech');
    expect(result.current.isListening).toBe(false);
  });

  it('should stop listening on recognition end', () => {
    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    act(() => {
      if (mockRecognitionInstance.onend) {
        mockRecognitionInstance.onend();
      }
    });

    expect(result.current.isListening).toBe(false);
  });

  it('should clear transcript and error on start', () => {
    const { result } = renderHook(() => useVoiceRecording());

    act(() => {
      result.current.startRecording();
    });

    act(() => {
      if (mockRecognitionInstance.onerror) {
        mockRecognitionInstance.onerror({ error: 'some error' });
      }
    });

    expect(result.current.error).toBe('some error');

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.transcript).toBe('');
  });
});

describe('useVoicePlayback', () => {
  let mockSpeechSynthesis: {
    speak: any;
    cancel: any;
    paused: boolean;
    speaking: boolean;
    onvoiceschanged: any;
  };

  beforeEach(() => {
    mockSpeechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      paused: false,
      speaking: false,
      onvoiceschanged: null,
    };

    // @ts-ignore
    globalThis.speechSynthesis = mockSpeechSynthesis;
  });

  afterEach(() => {
    // @ts-ignore
    delete globalThis.speechSynthesis;
    vi.clearAllMocks();
  });

  it('should initialize with isSpeaking false', () => {
    const { result } = renderHook(() => useVoicePlayback());
    expect(result.current.isSpeaking).toBe(false);
  });

  it('should speak text successfully', () => {
    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('Hello world');
    });

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0] as any;
    expect(utterance.text).toBe('Hello world');
    expect(utterance.lang).toBe('es-ES');
    expect(utterance.rate).toBe(0.9);
    expect(utterance.pitch).toBe(1.1);
  });

  it('should set isSpeaking to true when speech starts', () => {
    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('Test');
    });

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0] as any;

    act(() => {
      if (utterance.onstart) {
        utterance.onstart({});
      }
    });

    expect(result.current.isSpeaking).toBe(true);
  });

  it('should set isSpeaking to false when speech ends', () => {
    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('Test');
    });

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0] as any;

    act(() => {
      if (utterance.onstart) {
        utterance.onstart({});
      }
    });

    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      if (utterance.onend) {
        utterance.onend({});
      }
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('should handle speech error', () => {
    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('Test');
    });

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0] as any;

    act(() => {
      if (utterance.onerror) {
        utterance.onerror({});
      }
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it('should stop speaking when stop is called', () => {
    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('Test');
    });

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0] as any;

    act(() => {
      if (utterance.onstart) {
        utterance.onstart({});
      }
    });

    act(() => {
      result.current.stop();
    });

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('should do nothing when speech synthesis is not supported', () => {
    // @ts-ignore
    delete globalThis.speechSynthesis;

    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('Test');
    });

    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('should create new utterance for each speak call', () => {
    const { result } = renderHook(() => useVoicePlayback());

    act(() => {
      result.current.speak('First message');
    });

    act(() => {
      result.current.speak('Second message');
    });

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);

    const firstUtterance = mockSpeechSynthesis.speak.mock.calls[0][0] as any;
    const secondUtterance = mockSpeechSynthesis.speak.mock.calls[1][0] as any;

    expect(firstUtterance.text).toBe('First message');
    expect(secondUtterance.text).toBe('Second message');
  });
});
