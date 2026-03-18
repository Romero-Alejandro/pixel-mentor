import { useState, useEffect, useId } from 'react';
import {
  IconSettings,
  IconChevronDown,
  IconChevronUp,
  IconPlayerPlay,
  IconCheck,
} from '@tabler/icons-react';

import { cn } from '@/utils/cn';

// Voice settings type
export interface VoiceSettings {
  character: 'person' | 'robot' | 'animal' | 'cartoon';
  speakingRate: number;
  pitch: number;
  languageCode: string;
}

// Default settings
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  character: 'person',
  speakingRate: 1.0,
  pitch: 0,
  languageCode: 'es-ES',
};

type CharacterId = 'person' | 'robot' | 'animal' | 'cartoon';

interface CharacterOption {
  id: CharacterId;
  name: string;
  emoji: string;
  description: string;
}

const CHARACTERS: CharacterOption[] = [
  { id: 'person', name: 'Voz Estándar', emoji: '🎤', description: 'Voz natural y clara' },
  { id: 'robot', name: 'Robot', emoji: '🤖', description: 'Voz mecánica' },
  { id: 'animal', name: 'Animado', emoji: '🐱', description: 'Voz divertida' },
  { id: 'cartoon', name: 'Cómico', emoji: '🎭', description: 'Voz expresiva' },
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

  // Generación de IDs únicos para accesibilidad
  const languageId = useId();
  const speedId = useId();
  const pitchId = useId();

  useEffect(() => {
    const saved = localStorage.getItem('pixel-mentor-voice-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onSettingsChange({ ...DEFAULT_VOICE_SETTINGS, ...parsed });
      } catch {
        // Fallback to default
      }
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

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200',
          'bg-white border border-slate-200 hover:border-sky-300 hover:shadow-sm',
          'text-slate-700 font-medium',
          isOpen && 'border-sky-300 bg-sky-50',
        )}
      >
        <IconSettings className={cn('w-5 h-5', isOpen && 'text-sky-500')} />
        <span className="hidden sm:inline">Ajustar Voz</span>
        <span className="sm:hidden">Voz</span>
        {currentCharacter ? <span className="ml-1 text-lg">{currentCharacter.emoji}</span> : null}
        {isOpen ? (
          <IconChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <IconChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen ? (
        <div className="absolute top-full mt-2 right-0 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Configuración de Voz</h3>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-sky-100 text-sky-700 hover:bg-sky-200 disabled:opacity-50 transition-colors"
            >
              <IconPlayerPlay className={cn('w-4 h-4', previewing && 'animate-pulse')} />
              {previewing ? '...' : 'Probar'}
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Character Selection */}
            <div>
              <span className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
                Tipo de Voz
              </span>
              <div className="grid grid-cols-2 gap-2" role="group">
                {CHARACTERS.map((char) => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => handleSettingsChange({ ...settings, character: char.id })}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left',
                      settings.character === char.id
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-100 hover:border-slate-200',
                    )}
                  >
                    <span className="text-xl">{char.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{char.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{char.description}</div>
                    </div>
                    {settings.character === char.id ? (
                      <IconCheck className="w-4 h-4 text-sky-500 flex-shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label
                htmlFor={languageId}
                className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider"
              >
                Idioma
              </label>
              <select
                id={languageId}
                value={settings.languageCode}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, languageCode: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-slate-800 font-semibold focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Speed Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={speedId}
                  className="text-sm font-bold text-slate-700 uppercase tracking-wider"
                >
                  Velocidad
                </label>
                <span className="text-xs font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                  {settings.speakingRate.toFixed(1)}x
                </span>
              </div>
              <input
                id={speedId}
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.speakingRate}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, speakingRate: parseFloat(e.target.value) })
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-sky-500"
              />
            </div>

            {/* Pitch Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={pitchId}
                  className="text-sm font-bold text-slate-700 uppercase tracking-wider"
                >
                  Tono
                </label>
                <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch}
                </span>
              </div>
              <input
                id={pitchId}
                type="range"
                min="-10"
                max="10"
                step="1"
                value={settings.pitch}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, pitch: parseInt(e.target.value) })
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-purple-500"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
