import { useState, useEffect, useCallback } from 'react';
import { IconPlayerPlay, IconCheck, IconChevronDown } from '@tabler/icons-react';

import { useAudio } from '../../contexts/AudioContext';
import { MicroAudioEvent } from '../../audio/types/audio-events';

import { VOICE_OPTIONS } from '@/hooks/useVoice';

interface VoiceSelectorProps {
  onVoiceChange?: (voiceUri: string) => void;
  className?: string;
}

export function VoiceSelector({ onVoiceChange, className = '' }: VoiceSelectorProps) {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    return localStorage.getItem('pixel-mentor-selected-voice') || 'sofia';
  });
  const [isOpen, setIsOpen] = useState(false);
  const { playMicro } = useAudio();

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const spanishVoices = voices.filter(
        (v) => v.lang.startsWith('es') || v.lang.includes('spanish'),
      );
      setAvailableVoices(spanishVoices.length > 0 ? spanishVoices : voices);
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Get best voice for option
  const getVoiceForOption = useCallback(
    (_optionId: string): SpeechSynthesisVoice | null => {
      if (availableVoices.length === 0) {
        return null;
      }

      const spanishVoice = availableVoices.find((v) => v.lang.startsWith('es'));
      return spanishVoice || availableVoices[0];
    },
    [availableVoices],
  );

  // Handle voice selection
  const handleSelect = useCallback(
    (voiceId: string) => {
      playMicro(MicroAudioEvent.SelectOption);
      setSelectedVoiceId(voiceId);
      localStorage.setItem('pixel-mentor-selected-voice', voiceId);

      const voice = getVoiceForOption(voiceId);
      if (voice && onVoiceChange) {
        onVoiceChange(voice.voiceURI);
      }
      setIsOpen(false);
    },
    [getVoiceForOption, onVoiceChange, playMicro],
  );

  // Preview voice
  const handlePreview = useCallback(
    (voiceId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      window.speechSynthesis.cancel();

      const voice = getVoiceForOption(voiceId);
      if (!voice) return;

      const settings: Record<string, { rate: number; pitch: number; volume: number }> = {
        sofia: { rate: 0.85, pitch: 1.1, volume: 0.9 },
        mateo: { rate: 0.85, pitch: 1.0, volume: 0.9 },
        luna: { rate: 0.9, pitch: 1.2, volume: 0.9 },
      };

      const utterance = new SpeechSynthesisUtterance('¡Hola! Soy tu tutor.');
      utterance.voice = voice;
      utterance.rate = settings[voiceId]?.rate || 0.85;
      utterance.pitch = settings[voiceId]?.pitch || 1.1;
      utterance.volume = settings[voiceId]?.volume || 0.9;

      window.speechSynthesis.speak(utterance);
    },
    [getVoiceForOption],
  );

  const currentOption = VOICE_OPTIONS.find((v) => v.id === selectedVoiceId);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => {
          playMicro(MicroAudioEvent.DropdownToggle);
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-sky-300 hover:bg-sky-50 transition-all duration-200 text-sm"
        aria-label="Seleccionar voz"
        aria-expanded={isOpen}
      >
        <span className="w-5 h-5 flex items-center justify-center">
          <span className="text-lg">🔊</span>
        </span>
        <span className="text-slate-700 font-medium">{currentOption?.name || 'Voz'}</span>
        <IconChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen ? (
        <div className="absolute top-full mt-2 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {VOICE_OPTIONS.map((option) => (
            <div
              key={option.id}
              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                selectedVoiceId === option.id
                  ? 'bg-sky-50 border-l-4 border-sky-500'
                  : 'hover:bg-slate-50 border-l-4 border-transparent'
              }`}
            >
              <button
                onClick={(e) => handlePreview(option.id, e)}
                className="w-8 h-8 flex items-center justify-center bg-sky-100 text-sky-600 rounded-full hover:bg-sky-200 transition-colors"
                aria-label={`Preview voz ${option.name}`}
              >
                <IconPlayerPlay className="w-4 h-4" />
              </button>
              <button onClick={() => handleSelect(option.id)} className="flex-1 text-left">
                <div className="font-medium text-slate-800">{option.name}</div>
                <div className="text-xs text-slate-500">{option.description}</div>
              </button>
              {selectedVoiceId === option.id ? (
                <IconCheck className="w-5 h-5 text-sky-500" />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Helper function to get voice settings (kept for compatibility)
export function getVoiceSettings(voiceId: string) {
  const settings: Record<string, { rate: number; pitch: number; volume: number }> = {
    sofia: { rate: 0.85, pitch: 1.1, volume: 0.9 },
    mateo: { rate: 0.85, pitch: 1.0, volume: 0.9 },
    luna: { rate: 0.9, pitch: 1.2, volume: 0.9 },
  };
  return (
    settings[voiceId] || {
      rate: 0.85,
      pitch: 1.1,
      volume: 0.9,
    }
  );
}
