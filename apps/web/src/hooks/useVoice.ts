import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionInstance {
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionResultEvent {
  results: {
    0: {
      0: { transcript: string };
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface INativeWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface UseVoiceRecordingReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const startRecording = useCallback((): void => {
    const win = window as INativeWindow;
    if (!win.SpeechRecognition && !win.webkitSpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionResultEvent): void => {
      const transcriptResult = event.results[0][0].transcript;
      setTranscript(transcriptResult);
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
      setError(event.error || 'Recognition error');
      setIsListening(false);
    };

    recognition.onend = (): void => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      setError(null);
      setTranscript('');
    } catch {
      setError('Failed to start recording');
      setIsListening(false);
    }
  }, []);

  const stopRecording = useCallback((): void => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect((): (() => void) => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return { isListening, transcript, error, startRecording, stopRecording };
}

interface UseVoicePlaybackReturn {
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

export function useVoicePlayback(): UseVoicePlaybackReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const updateVoices = useCallback((): void => {
    setVoices(window.speechSynthesis.getVoices());
  }, []);

  useEffect((): (() => void) => {
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [updateVoices]);

  const speak = useCallback(
    (text: string): void => {
      if (!('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith('es') &&
          (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')),
      );

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = (): void => setIsSpeaking(true);
      utterance.onend = (): void => setIsSpeaking(false);
      utterance.onerror = (): void => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voices],
  );

  const stop = useCallback((): void => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
}
