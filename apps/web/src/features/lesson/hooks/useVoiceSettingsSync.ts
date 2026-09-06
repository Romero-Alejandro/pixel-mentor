/**
 * useVoiceSettingsSync
 *
 * Syncs voice settings from the UI panel into a module-level variable
 * so the orchestrator can access them without prop drilling.
 */

import { useEffect } from 'react';
import type { VoiceSettings } from '@/features/voice/hooks/useVoice';

let _voiceSettings: VoiceSettings = {};

export function getVoiceSettings(): VoiceSettings {
  return _voiceSettings;
}

export function useVoiceSettingsSync(settings: VoiceSettings): void {
  useEffect(() => {
    _voiceSettings = settings;
  }, [settings]);
}
