import { useState, useCallback } from 'react';

import { type VoiceSettings, DEFAULT_VOICE_SETTINGS } from '../components/VoiceSettingsPanel';

/**
 * Hook to manage the voice tutor configuration.
 * Handles local state and localStorage persistence.
 */
export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    // Retrieve saved configuration on initialization
    const saved = localStorage.getItem('pixel-mentor-voice-settings');
    if (saved) {
      try {
        return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
      } catch (error) {
        console.error('Error parsing voice settings:', error);
        return DEFAULT_VOICE_SETTINGS;
      }
    }
    return DEFAULT_VOICE_SETTINGS;
  });

  /**
   * Partially updates the configuration and persists changes.
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
