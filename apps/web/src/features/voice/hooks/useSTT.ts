import { useState, useRef, useCallback } from 'react';

import { logger } from '@/utils/logger';

export interface UseSTTReturn {
  isListening: boolean;
  transcript: string;
  confidence: number;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  error: string | null;
  isRecognitionSupported: boolean;
}

// Debug logging
const debugLog = (...args: unknown[]): void => {
  logger.log('[STT]', ...args);
};

const debugError = (...args: unknown[]): void => {
  console.error('[STT ERROR]', ...args);
};

export function useSTT(): UseSTTReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Check browser support
  const isRecognitionSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isRecognitionSupported) {
      setError('Navegador no compatible con reconocimiento de voz');
      return;
    }

    const SpeechRecognitionAPI =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;

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

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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

      recognition.onresult = (event: SpeechRecognitionEvent) => {
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
  }, [isRecognitionSupported]);

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
    isListening,
    transcript,
    confidence,
    startListening,
    stopListening,
    clearTranscript,
    error,
    isRecognitionSupported,
  };
}

// Cleanup function for unmounting
export function useSTTCleanup() {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
  }, []);

  return cleanup;
}
