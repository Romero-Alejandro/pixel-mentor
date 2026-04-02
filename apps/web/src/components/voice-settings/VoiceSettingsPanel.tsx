import { useState, useEffect, useId } from 'react';
import {
  IconSettings,
  IconChevronDown,
  IconChevronUp,
  IconPlayerPlay,
  IconCheck,
  IconMicrophone,
  IconRobot,
  IconCat,
  IconMasksTheater,
} from '@tabler/icons-react';

import { useAudio } from '../../contexts/AudioContext';
import { MicroAudioEvent } from '../../audio/types/audio-events';

import { cn } from '@/utils/cn';

export interface VoiceSettings {
  character?: 'person' | 'robot' | 'animal' | 'cartoon';
  speakingRate?: number;
  pitch?: number;
  languageCode?: string;
}

export const DEFAULT_VOICE_SETTINGS: Required<VoiceSettings> = {
  character: 'person',
  speakingRate: 1.0,
  pitch: 0,
  languageCode: 'es-ES',
};

type CharacterId = 'person' | 'robot' | 'animal' | 'cartoon';

interface CharacterOption {
  id: CharacterId;
  name: string;
  icon: React.ElementType;
  description: string;
}

const CHARACTERS: CharacterOption[] = [
  { id: 'person', name: 'Voz Estándar', icon: IconMicrophone, description: 'Voz natural y clara' },
  { id: 'robot', name: 'Robot', icon: IconRobot, description: 'Voz mecánica' },
  { id: 'animal', name: 'Animado', icon: IconCat, description: 'Voz divertida' },
  { id: 'cartoon', name: 'Cómico', icon: IconMasksTheater, description: 'Voz expresiva' },
];

interface LanguageOption {
  code: string;
  name: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'es-ES', name: 'Español (España)' },
  { code: 'es-MX', name: 'Español (México)' },
  { code: 'es-419', name: 'Español (Latinoamérica)' },
  { code: 'en-US', name: 'English (US)' },
];

interface VoiceSettingsPanelProps {
  settings: VoiceSettings;
  onSettingsChange: (settings: VoiceSettings) => void;
  onPreview?: (settings: VoiceSettings) => void;
  className?: string;
}

export function VoiceSettingsPanel({
  settings,
  onSettingsChange,
  onPreview,
  className = '',
}: VoiceSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const { playMicro } = useAudio();

  const languageId = useId();
  const speedId = useId();
  const pitchId = useId();

  useEffect(() => {
    const saved = localStorage.getItem('pixel-mentor-voice-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onSettingsChange({ ...DEFAULT_VOICE_SETTINGS, ...parsed });
      } catch {}
    }
  }, [onSettingsChange]);

  const handleSettingsChange = (newSettings: VoiceSettings) => {
    onSettingsChange(newSettings);
    localStorage.setItem('pixel-mentor-voice-settings', JSON.stringify(newSettings));
  };

  const handlePreview = async () => {
    if (!onPreview || previewing) return;
    setPreviewing(true);
    try {
      await onPreview(settings);
    } finally {
      setTimeout(() => setPreviewing(false), 1000);
    }
  };

  const currentCharacter = CHARACTERS.find((c) => c.id === settings.character);
  const CurrentIcon = currentCharacter?.icon;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          playMicro(isOpen ? MicroAudioEvent.ModalClose : MicroAudioEvent.ModalOpen);
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-2xl border-4 transition-all duration-200 outline-none',
          'bg-white border-sky-200 text-sky-800 font-bold shadow-[0_4px_0_0_#bae6fd]',
          'hover:-translate-y-1 hover:shadow-[0_6px_0_0_#bae6fd] active:translate-y-1 active:shadow-none cursor-pointer',
          isOpen && 'border-sky-300 bg-sky-50 shadow-none translate-y-1',
        )}
      >
        <IconSettings className="w-5 h-5 text-sky-500" stroke={2.5} />
        <span className="hidden sm:inline">Ajustar Voz</span>
        {CurrentIcon ? <CurrentIcon className="w-5 h-5 text-sky-600" stroke={2.5} /> : null}
        {isOpen ? (
          <IconChevronUp className="w-4 h-4 text-sky-400" stroke={3} />
        ) : (
          <IconChevronDown className="w-4 h-4 text-sky-400" stroke={3} />
        )}
      </button>

      {isOpen ? (
        <div className="absolute top-full mt-3 right-0 w-80 sm:w-96 bg-white border-4 border-sky-200 rounded-[2rem] shadow-[0_8px_0_0_#bae6fd] z-50 overflow-hidden animate-bounce-in">
          <div className="px-6 py-4 bg-sky-50 border-b-4 border-sky-100 flex items-center justify-between">
            <h3 className="font-black text-sky-900">Configuración</h3>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-sky-400 text-white shadow-[0_4px_0_0_#0284c7] hover:bg-sky-300 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:transform-none disabled:shadow-none transition-all cursor-pointer"
            >
              <IconPlayerPlay className={cn('w-4 h-4', previewing && 'animate-pulse')} stroke={3} />
              {previewing ? '...' : 'Probar'}
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <span className="block text-xs font-black text-sky-700 mb-3 uppercase tracking-wider">
                Tipo de Voz
              </span>
              <div className="grid grid-cols-2 gap-3" role="group">
                {CHARACTERS.map((char) => {
                  const CharIcon = char.icon;
                  const isSelected = settings.character === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => {
                        playMicro(MicroAudioEvent.SelectOption);
                        handleSettingsChange({ ...settings, character: char.id });
                      }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-2xl border-4 transition-all text-center cursor-pointer outline-none',
                        isSelected
                          ? 'border-sky-400 bg-sky-50 shadow-none translate-y-1'
                          : 'border-slate-100 bg-white hover:border-sky-200 hover:-translate-y-1 shadow-[0_4px_0_0_#e2e8f0]',
                      )}
                    >
                      <CharIcon
                        className={cn('w-8 h-8', isSelected ? 'text-sky-500' : 'text-slate-400')}
                        stroke={2}
                      />
                      <div className="w-full min-w-0">
                        <div
                          className={cn(
                            'text-sm font-black truncate',
                            isSelected ? 'text-sky-900' : 'text-slate-600',
                          )}
                        >
                          {char.name}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 truncate">
                          {char.description}
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="absolute top-2 right-2 bg-sky-400 rounded-full p-0.5">
                          <IconCheck className="w-3 h-3 text-white" stroke={4} />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor={languageId}
                className="block text-xs font-black text-sky-700 mb-2 uppercase tracking-wider"
              >
                Idioma
              </label>
              <select
                id={languageId}
                value={settings.languageCode}
                onFocus={() => playMicro(MicroAudioEvent.Focus)}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, languageCode: e.target.value })
                }
                className="w-full px-4 py-3 rounded-2xl border-4 border-slate-200 bg-slate-50 text-slate-800 font-bold focus:border-sky-400 focus:bg-white outline-none transition-all cursor-pointer appearance-none"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label
                  htmlFor={speedId}
                  className="text-xs font-black text-sky-700 uppercase tracking-wider"
                >
                  Velocidad
                </label>
                <span className="text-xs font-black text-white bg-sky-500 px-3 py-1 rounded-full">
                  {(settings.speakingRate ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                id={speedId}
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.speakingRate}
                onFocus={() => playMicro(MicroAudioEvent.Focus)}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, speakingRate: parseFloat(e.target.value) })
                }
                className="w-full h-3 rounded-full appearance-none cursor-pointer bg-slate-200 accent-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label
                  htmlFor={pitchId}
                  className="text-xs font-black text-sky-700 uppercase tracking-wider"
                >
                  Tono
                </label>
                <span className="text-xs font-black text-white bg-purple-500 px-3 py-1 rounded-full">
                  {(settings.pitch ?? 0) > 0 ? `+${settings.pitch}` : settings.pitch}
                </span>
              </div>
              <input
                id={pitchId}
                type="range"
                min="-10"
                max="10"
                step="1"
                value={settings.pitch}
                onFocus={() => playMicro(MicroAudioEvent.Focus)}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, pitch: parseInt(e.target.value) })
                }
                className="w-full h-3 rounded-full appearance-none cursor-pointer bg-slate-200 accent-purple-500"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
