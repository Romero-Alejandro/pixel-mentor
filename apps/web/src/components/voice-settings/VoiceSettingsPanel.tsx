import { useState, useEffect } from 'react';
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

// Character options
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

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pixel-mentor-voice-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onSettingsChange({ ...DEFAULT_VOICE_SETTINGS, ...parsed });
      } catch {
        // Use defaults
      }
    }
  }, []);

  // Save settings to localStorage when they change
  const handleSettingsChange = (newSettings: VoiceSettings) => {
    onSettingsChange(newSettings);
    localStorage.setItem('pixel-mentor-voice-settings', JSON.stringify(newSettings));
  };

  // Preview voice
  const handlePreview = async () => {
    if (!onPreview || previewing) return;

    setPreviewing(true);
    try {
      await onPreview(settings);
    } finally {
      setTimeout(() => setPreviewing(false), 1000);
    }
  };

  // Get current character info
  const currentCharacter = CHARACTERS.find((c) => c.id === settings.character);

  return (
    <div className={cn('relative', className)}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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

      {/* Settings Panel */}
      {isOpen ? (
        <div className="absolute top-full mt-2 right-0 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Configuración de Voz</h3>
            <button
              onClick={handlePreview}
              disabled={previewing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                'bg-sky-100 text-sky-700 hover:bg-sky-200 disabled:opacity-50',
              )}
            >
              <IconPlayerPlay className={cn('w-4 h-4', previewing && 'animate-pulse')} />
              {previewing ? 'Reproduciendo...' : 'Probar'}
            </button>
          </div>

          <div className="p-4 space-y-5">
            {/* Character Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Voz</label>
              <div className="grid grid-cols-2 gap-2">
                {CHARACTERS.map((char) => (
                  <button
                    key={char.id}
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
                      <div className="text-sm font-medium text-slate-800 truncate">{char.name}</div>
                      <div className="text-xs text-slate-500 truncate">{char.description}</div>
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Idioma</label>
              <select
                value={settings.languageCode}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, languageCode: e.target.value })
                }
                className={cn(
                  'w-full px-3 py-2.5 rounded-xl border-2 border-slate-200',
                  'bg-white text-slate-800 font-medium',
                  'focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100',
                  'transition-all duration-200',
                )}
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
                <label className="text-sm font-medium text-slate-700">Velocidad</label>
                <span className="text-sm font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                  {settings.speakingRate.toFixed(1)}x
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-8">0.5x</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.speakingRate}
                  onChange={(e) =>
                    handleSettingsChange({ ...settings, speakingRate: parseFloat(e.target.value) })
                  }
                  className={cn(
                    'flex-1 h-2 rounded-full appearance-none cursor-pointer',
                    'bg-slate-200',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:w-5',
                    '[&::-webkit-slider-thumb]:h-5',
                    '[&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-sky-500',
                    '[&::-webkit-slider-thumb]:cursor-pointer',
                    '[&::-webkit-slider-thumb]:shadow-md',
                    '[&::-webkit-slider-thumb]:transition-transform',
                    '[&::-webkit-slider-thumb]:hover:scale-110',
                    '[&::-moz-range-thumb]:w-5',
                    '[&::-moz-range-thumb]:h-5',
                    '[&::-moz-range-thumb]:rounded-full',
                    '[&::-moz-range-thumb]:bg-sky-500',
                    '[&::-moz-range-thumb]:border-0',
                    '[&::-moz-range-thumb]:cursor-pointer',
                  )}
                />
                <span className="text-xs text-slate-400 w-8 text-right">2.0x</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400">Lenta</span>
                <span className="text-xs text-slate-400">Normal</span>
                <span className="text-xs text-slate-400">Rápida</span>
              </div>
            </div>

            {/* Pitch Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Tono</label>
                <span className="text-sm font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                  {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-8">-10</span>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  value={settings.pitch}
                  onChange={(e) =>
                    handleSettingsChange({ ...settings, pitch: parseInt(e.target.value) })
                  }
                  className={cn(
                    'flex-1 h-2 rounded-full appearance-none cursor-pointer',
                    'bg-slate-200',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:w-5',
                    '[&::-webkit-slider-thumb]:h-5',
                    '[&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-purple-500',
                    '[&::-webkit-slider-thumb]:cursor-pointer',
                    '[&::-webkit-slider-thumb]:shadow-md',
                    '[&::-webkit-slider-thumb]:transition-transform',
                    '[&::-webkit-slider-thumb]:hover:scale-110',
                    '[&::-moz-range-thumb]:w-5',
                    '[&::-moz-range-thumb]:h-5',
                    '[&::-moz-range-thumb]:rounded-full',
                    '[&::-moz-range-thumb]:bg-purple-500',
                    '[&::-moz-range-thumb]:border-0',
                    '[&::-moz-range-thumb]:cursor-pointer',
                  )}
                />
                <span className="text-xs text-slate-400 w-8 text-right">+10</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400">Grave</span>
                <span className="text-xs text-slate-400">Normal</span>
                <span className="text-xs text-slate-400">Aguda</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Hook for managing voice settings
export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    const saved = localStorage.getItem('pixel-mentor-voice-settings');
    if (saved) {
      try {
        return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_VOICE_SETTINGS;
      }
    }
    return DEFAULT_VOICE_SETTINGS;
  });

  const updateSettings = (newSettings: Partial<VoiceSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('pixel-mentor-voice-settings', JSON.stringify(updated));
  };

  return { settings, updateSettings };
}
