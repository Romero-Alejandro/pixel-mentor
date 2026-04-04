import { useState, useCallback } from 'react';

import { type VoiceSettings, DEFAULT_VOICE_SETTINGS } from '../components/VoiceSettingsPanel';

/**r
 * Hook para gestionar la configuración de voz del tutor.
 * Maneja el estado local y la persistencia en localStorage.
 */
export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    // Recuperar configuración guardada al inicializar
    const saved = localStorage.getItem('pixel-mentor-voice-settings');
    if (saved) {
      try {
        return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
      } catch (error) {
        console.error('Error parseando voice settings:', error);
        return DEFAULT_VOICE_SETTINGS;
      }
    }
    return DEFAULT_VOICE_SETTINGS;
  });

  /**
   * Actualiza la configuración de forma parcial y persiste los cambios.
   */
  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('pixel-mentor-voice-settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    settings,
    updateSettings,
  };
}
