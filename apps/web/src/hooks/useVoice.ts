import { useState, useRef, useCallback, useEffect } from 'react';

import { apiClient } from '../services/api';

// Voice settings for backend TTS
export interface VoiceSettings {
  character?: 'person' | 'robot' | 'animal' | 'cartoon';
  speakingRate?: number;
  pitch?: number;
  languageCode?: string;
}

// Legacy type for browser TTS
export interface LegacyVoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
}

// Confirmation phrases
const CONFIRMATION_PHRASES = [
  'Me estás preguntando si {text}, ¿es correcto?',
  'Entonces quieres saber sobre {text}, ¿verdad?',
  'Dijiste {text}, ¿estoy en lo correcto?',
  'Entendí que preguntas sobre {text}, ¿sí?',
];

export interface UseVoiceReturn {
  isSpeaking: boolean;
  speak: (text: string, voiceSettings?: VoiceSettings) => Promise<boolean>;
  stopSpeaking: () => void;
  isListening: boolean;
  transcript: string;
  confidence: number;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  error: string | null;
  availableVoices: SpeechSynthesisVoice[];
  isSupported: boolean;
  isSpeechSupported: boolean;
  isRecognitionSupported: boolean;
}

// Debug logging
const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log('[Voice]', ...args);
  }
};

const debugError = (...args: any[]) => {
  console.error('[Voice ERROR]', ...args);
};

export function useVoice(): UseVoiceReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<any>(null);

  // Check browser support
  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isRecognitionSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const isSupported = isSpeechSupported && isRecognitionSupported;

  // Load available voices - with multiple retry strategies
  useEffect(() => {
    if (!isSpeechSupported) return;

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        debugLog('Voices loaded:', voices.length);
        setAvailableVoices(voices);

        // If no voices yet, schedule another load attempt
        if (voices.length === 0) {
          debugLog('No voices found, will retry...');
        }
      } catch (e) {
        debugError('Error loading voices:', e);
      }
    };

    // Method 1: Load immediately
    loadVoices();

    // Method 2: Wait for onvoiceschanged event (most browsers)
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Method 3: Poll for voices (some browsers load async)
    const pollInterval = setInterval(() => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        debugLog('Voices loaded via poll:', voices.length);
        setAvailableVoices(voices);
        clearInterval(pollInterval);
      }
    }, 500);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSpeechSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSpeechSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          // Ignore
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [isSpeechSupported]);

  const stopSpeaking = useCallback(() => {
    if (!isSpeechSupported) return;

    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      debugError('Error stopping speech:', e);
    }
    setIsSpeaking(false);
  }, [isSpeechSupported]);

  const speak = useCallback(
    async (text: string, voiceSettings?: VoiceSettings): Promise<boolean> => {
      debugLog('speak() called with:', text?.substring(0, 50));

      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        debugLog('Empty text, skipping speak');
        return false;
      }

      // Merge with defaults
      const settings = {
        character: voiceSettings?.character || 'person',
        languageCode: voiceSettings?.languageCode || 'es-ES',
        speakingRate: voiceSettings?.speakingRate ?? 1.0,
        pitch: voiceSettings?.pitch ?? 0,
      };

      setError(null);
      setIsSpeaking(true);

      // Strategy 1: Try backend TTS (primary)
      try {
        debugLog('Trying backend TTS...', settings);

        const response = await apiClient.post('/api/tts/speak', {
          text: text.trim(),
          character: settings.character,
          languageCode: settings.languageCode,
          speakingRate: settings.speakingRate,
          pitch: settings.pitch,
        });

        const data = response.data;

        if (!data.audioContent) {
          throw new Error('No audio content in response');
        }

        // Decode base64 audio and play
        const audioBytes = Uint8Array.from(atob(data.audioContent), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);

        audio.onplay = () => {
          debugLog('Backend TTS playing');
          setError(null);
        };

        audio.onended = () => {
          debugLog('Backend TTS ended');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = (err) => {
          debugError('Audio playback error:', err);
          setError('Error al reproducir audio');
          setIsSpeaking(false);
        };

        await audio.play();
        debugLog('Backend TTS started successfully!');
        return true;
      } catch (backendErr) {
        debugError('Backend TTS failed:', backendErr);

        // Strategy 2: Fallback to browser TTS
        debugLog('Falling back to browser TTS...');

        try {
          const utterance = new SpeechSynthesisUtterance(text.trim());

          utterance.onstart = () => {
            debugLog('Browser TTS started successfully');
            setError(null);
          };

          utterance.onend = () => {
            debugLog('Browser TTS ended');
            setIsSpeaking(false);
          };

          utterance.onerror = (event) => {
            debugError('Browser TTS error:', event.error);
            setIsSpeaking(false);
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
              setError(`Error de voz: ${event.error}`);
            }
          };

          window.speechSynthesis.speak(utterance);

          // Check if it started
          setTimeout(() => {
            if (window.speechSynthesis.speaking) {
              return true;
            }
          }, 50);

          return true;
        } catch (browserErr) {
          debugError('Browser TTS also failed:', browserErr);
          setError('No se pudo reproducir la voz');
          setIsSpeaking(false);
          return false;
        }
      }
    },
    [],
  );

  const startListening = useCallback(() => {
    if (!isRecognitionSupported) {
      setError('Navegador no compatible con reconocimiento de voz');
      return;
    }

    // Stop any current speech
    stopSpeaking();

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('Navegador no compatible con reconocimiento de voz');
      return;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
    }

    try {
      const recognition = new SpeechRecognitionAPI();

      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.continuous = false;

      recognition.onstart = () => {
        debugLog('Recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('');
        setConfidence(0);
      };

      recognition.onend = () => {
        debugLog('Recognition ended');
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        debugError('Recognition error:', event.error);

        if (event.error === 'not-allowed') {
          setError('Permiso de micrófono denegado');
        } else if (event.error === 'no-speech') {
          // Normal - no speech detected
          setError(null);
        } else if (event.error === 'network') {
          // Browser speech recognition requires internet (Google servers)
          setError('Se requiere internet para reconocimiento de voz');
        } else if (event.error !== 'aborted') {
          setError(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const results = Array.from(event.results) as SpeechRecognitionResult[];
        const lastResult = results[results.length - 1];

        if (lastResult.isFinal) {
          const alternative = lastResult[0];
          setTranscript(alternative.transcript);
          setConfidence(alternative.confidence);
          debugLog('Final transcript:', alternative.transcript);
        } else {
          setTranscript(lastResult[0].transcript);
          debugLog(' Interim transcript:', lastResult[0].transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      debugLog('Recognition started');
    } catch (err) {
      debugError('Failed to start recognition:', err);
      setError('Error al iniciar reconocimiento');
    }
  }, [isRecognitionSupported, stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setConfidence(0);
  }, []);

  return {
    isSpeaking,
    speak,
    stopSpeaking,
    isListening,
    transcript,
    confidence,
    startListening,
    stopListening,
    clearTranscript,
    error,
    availableVoices,
    isSupported,
    isSpeechSupported,
    isRecognitionSupported,
  };
}

// Helper
export function getRandomConfirmationPhrase(understoodText: string): string {
  if (!understoodText?.trim()) {
    return '¿Puedes repetirlo?';
  }
  const phrase = CONFIRMATION_PHRASES[Math.floor(Math.random() * CONFIRMATION_PHRASES.length)];
  return phrase.replace('{text}', understoodText);
}

export const VOICE_OPTIONS = [
  { id: 'default', name: 'Voz predeterminada', description: 'Voz del navegador' },
] as const;

export type VoicePresetId = (typeof VOICE_OPTIONS)[number]['id'];

export const useVoiceRecording = useVoice;
export const useVoicePlayback = useVoice;
