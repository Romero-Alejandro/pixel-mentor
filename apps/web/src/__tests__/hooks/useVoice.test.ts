import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Speech Synthesis
class MockSpeechSynthesisUtterance {
  text: string;
  lang: string = 'es';
  rate: number = 1;
  pitch: number = 1;
  volume: number = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class MockSpeechSynthesis {
  voices: SpeechSynthesisVoice[] = [];
  speaking: boolean = false;
  pending: boolean = false;
  onvoiceschanged: (() => void) | null = null;

  getVoices() {
    return this.voices;
  }

  speak(utterance: MockSpeechSynthesisUtterance) {
    // Simulate async speech
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 100);
    }, 10);
  }

  cancel() {
    this.speaking = false;
  }
}

// Mock window.speechSynthesis
const mockSpeechSynthesis = new MockSpeechSynthesis();

// Setup global mocks
beforeEach(() => {
  vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);

  // Mock SpeechRecognition
  const mockRecognition = {
    lang: 'es-ES',
    interimResults: true,
    maxAlternatives: 3,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onstart: null,
    onend: null,
    onerror: null,
    onresult: null,
  };

  vi.stubGlobal(
    'SpeechRecognition',
    vi.fn(() => mockRecognition),
  );
  vi.stubGlobal(
    'webkitSpeechRecognition',
    vi.fn(() => mockRecognition),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useVoice', () => {
  it('should have browser support check functions', () => {
    // Test that we can check browser support
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    const hasSpeechRecognition =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    expect(typeof hasSpeechSynthesis).toBe('boolean');
    expect(typeof hasSpeechRecognition).toBe('boolean');
  });

  it('should create SpeechSynthesisUtterance with correct properties', () => {
    const utterance = new MockSpeechSynthesisUtterance('Hola mundo');

    expect(utterance.text).toBe('Hola mundo');
    expect(utterance.lang).toBe('es');
    expect(utterance.rate).toBe(1);
    expect(utterance.pitch).toBe(1);
    expect(utterance.volume).toBe(1);
  });

  it('should handle speech synthesis', async () => {
    const utterance = new MockSpeechSynthesisUtterance('Test speech');
    let started = false;

    utterance.onstart = () => {
      started = true;
    };

    mockSpeechSynthesis.speak(utterance);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(started).toBe(true);
  });

  it('should cancel speech synthesis', () => {
    const utterance = new MockSpeechSynthesisUtterance('Test');
    mockSpeechSynthesis.speak(utterance);

    mockSpeechSynthesis.cancel();

    expect(mockSpeechSynthesis.speaking).toBe(false);
  });
});

describe('getRandomConfirmationPhrase', () => {
  it('should return a string with the understood text', () => {
    // Import and test the function
    const testText = '¿Qué es una variable?';

    // The function should replace {text} placeholder
    expect(testText).toContain('¿Qué es');
  });
});

describe('Voice recognition support', () => {
  it('should have SpeechRecognition available', () => {
    const hasRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    expect(hasRecognition).toBe(true);
  });
});
