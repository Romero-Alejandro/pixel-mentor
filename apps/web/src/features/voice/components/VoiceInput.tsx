import { useState, useEffect, useRef } from 'react';
import { IconMicrophone } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';
import { useVoice } from '@/features/voice/hooks/useVoice';
import { Button } from '@/components/ui';

type VoiceInputState = 'idle' | 'listening' | 'processing';

interface VoiceInputProps {
  onConfirm: (text: string) => void;
}

export function VoiceInput({ onConfirm }: VoiceInputProps) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [understoodText, setUnderstoodText] = useState('');
  const { playSprite } = useAudio();

  const {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript,
    isRecognitionSupported,
  } = useVoice();

  const lastTranscriptRef = useRef('');

  useEffect(() => {
    if (state === 'listening') {
      playSprite(SpriteAudioEvent.VoiceRecordingStart);
    } else if (state === 'processing') {
      playSprite(SpriteAudioEvent.VoiceRecordingStop);
    }
  }, [state, playSprite]);

  useEffect(() => {
    if (state === 'listening' && !isListening) {
      startListening();
    }
  }, [state, isListening, startListening]);

  useEffect(() => {
    if (transcript && state === 'listening' && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript;
      setUnderstoodText(transcript);
    }
  }, [transcript, state]);

  useEffect(() => {
    if (state === 'listening' && !isListening) {
      if (transcript && transcript.trim()) {
        setState('processing');
        setTimeout(() => {
          onConfirm(transcript.trim());
          reset();
        }, 300);
      } else {
        setState('idle');
      }
    }
  }, [state, isListening, transcript, onConfirm]);

  const reset = () => {
    lastTranscriptRef.current = '';
    if (state === 'listening') {
      playSprite(SpriteAudioEvent.VoiceRecordingStop);
    }
    setState('idle');
    setUnderstoodText('');
    clearTranscript();
    stopListening();
  };

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
        {isListening ? 'Te estoy escuchando...' : 'Cuenta tu duda'}
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
