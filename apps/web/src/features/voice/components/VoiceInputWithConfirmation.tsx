import { useState, useCallback, useEffect, useRef } from 'react';
import { IconMicrophone, IconCheck, IconX, IconReload } from '@tabler/icons-react';

import { useVoice, getRandomConfirmationPhrase } from '@/features/voice/hooks/useVoice';
import { Button, Input } from '@/components/ui';

type VoiceInputState = 'idle' | 'listening' | 'processing' | 'confirming' | 'rejected';

interface VoiceInputWithConfirmationProps {
  onConfirm: (text: string) => void;
}

export function VoiceInputWithConfirmation({ onConfirm }: VoiceInputWithConfirmationProps) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [understoodText, setUnderstoodText] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [fallbackText, setFallbackText] = useState('');

  const {
    isListening,
    transcript,
    confidence,
    error,
    speak,
    startListening,
    stopListening,
    clearTranscript,
    isRecognitionSupported,
  } = useVoice();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');

  // Auto-start listening when state changes to listening
  useEffect(() => {
    if (state === 'listening' && !isListening) {
      startListening();
    }
  }, [state, isListening, startListening]);

  // Update transcript in real-time
  useEffect(() => {
    if (transcript && state === 'listening' && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript;
      setUnderstoodText(transcript);
    }
  }, [transcript, state]);

  // When listening stops with transcript, move to processing
  useEffect(() => {
    if (state === 'listening' && !isListening && transcript && transcript.trim()) {
      setState('processing');

      // Generate confirmation phrase
      const phrase = getRandomConfirmationPhrase(transcript.trim());
      setConfirmationPhrase(phrase);

      // Small delay before confirmation
      timeoutRef.current = setTimeout(async () => {
        setState('confirming');
        if (isRecognitionSupported) {
          try {
            await speak(phrase);
          } catch (e) {
            console.error('Error speaking confirmation:', e);
          }
        }
      }, 500);
    } else if (state === 'listening' && !isListening && (!transcript || !transcript.trim())) {
      // No speech detected
      setState('idle');
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, isListening, transcript, speak, isRecognitionSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleYes = useCallback(async () => {
    try {
      await speak(''); // Stop any current speech
    } catch (e) {
      // Ignore
    }
    // Small delay to allow speech to stop
    setTimeout(() => {
      onConfirm(understoodText);
      reset();
    }, 100);
  }, [understoodText, onConfirm, speak]);

  const handleNo = useCallback(async () => {
    try {
      await speak('¡Entendido! ¿Puedes repetirlo o escribirlo?');
    } catch (e) {
      // Ignore
    }
    setState('rejected');
  }, [speak]);

  const handleFallbackSubmit = useCallback(() => {
    if (fallbackText.trim()) {
      onConfirm(fallbackText.trim());
      reset();
    }
  }, [fallbackText, onConfirm]);

  const handleRetry = useCallback(() => {
    lastTranscriptRef.current = '';
    setState('listening');
    clearTranscript();
    setUnderstoodText('');
    setConfirmationPhrase('');
  }, [clearTranscript]);

  const reset = useCallback(() => {
    lastTranscriptRef.current = '';
    setState('idle');
    setUnderstoodText('');
    setConfirmationPhrase('');
    setFallbackText('');
    clearTranscript();
    stopListening();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [clearTranscript, stopListening]);

  // Render based on state
  if (state === 'idle' || state === 'listening') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center w-full">
        <div className="w-20 h-20 mb-4 relative">
          {isListening ? (
            <>
              <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-50" />
              <div className="absolute inset-0 bg-amber-500 rounded-full animate-pulse flex items-center justify-center">
                <IconMicrophone className="w-8 h-8 text-white" />
              </div>
            </>
          ) : (
            <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center">
              <IconMicrophone className="w-8 h-8 text-sky-600" />
            </div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          {isListening ? 'Escuchando tu duda...' : 'Cuenta tu duda'}
        </h3>
        <p className="text-slate-500 mb-4 text-sm">
          {isListening ? 'Habla ahora' : 'Toca el micrófono y habla'}
        </p>

        {!isListening && !isRecognitionSupported ? (
          <p className="text-amber-600 text-sm mb-4">Voz no disponible en este navegador</p>
        ) : null}

        {!isListening && isRecognitionSupported ? (
          <Button onClick={() => setState('listening')} variant="secondary">
            <IconMicrophone className="w-5 h-5 mr-2" />
            Hablar
          </Button>
        ) : null}

        {understoodText ? (
          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 max-w-xs">
            "{understoodText}"
          </div>
        ) : null}

        {error ? <p className="mt-3 text-red-500 text-sm">{error}</p> : null}
      </div>
    );
  }

  if (state === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 mb-4 relative">
          <div className="absolute inset-0 bg-sky-400 rounded-full animate-ping opacity-50" />
          <div className="absolute inset-0 bg-sky-500 rounded-full animate-pulse flex items-center justify-center">
            <span className="text-2xl">🤔</span>
          </div>
        </div>
        <p className="text-slate-600 font-medium">Procesando...</p>
      </div>
    );
  }

  if (state === 'confirming') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center w-full">
        <div className="w-16 h-16 mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">🤖</span>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-2">{confirmationPhrase}</h3>

        <div className="mt-3 p-4 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700 max-w-xs">
          "{understoodText}"
        </div>

        {confidence > 0 ? (
          <p className="mt-2 text-xs text-slate-400">Confianza: {Math.round(confidence * 100)}%</p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Button onClick={handleYes} variant="primary" className="px-6">
            <IconCheck className="w-5 h-5 mr-2" />
            Sí
          </Button>
          <Button onClick={handleNo} variant="danger" className="px-6">
            <IconX className="w-5 h-5 mr-2" />
            No
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center w-full">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          ¿Puedes repetirlo o escribirlo?
        </h3>

        <div className="w-full max-w-xs space-y-3">
          <Input
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            placeholder="Escribe tu duda aquí..."
            onKeyDown={(e) => e.key === 'Enter' && handleFallbackSubmit()}
          />

          <div className="flex gap-2">
            <Button
              onClick={handleFallbackSubmit}
              disabled={!fallbackText.trim()}
              className="flex-1"
            >
              Enviar
            </Button>
            <Button onClick={handleRetry} variant="secondary">
              <IconReload className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
