import useSound from 'use-sound';

import { SpriteAudioEvent } from '../types/audio-events';
import { useAudioStore } from '../../stores/audio.store';

// Sprite map: event -> [startMs, durationMs] in milliseconds
const spriteMap: Record<SpriteAudioEvent, [number, number]> = {
  [SpriteAudioEvent.BadgeEarned]: [0, 956],
  [SpriteAudioEvent.LevelUp]: [956, 933],
  [SpriteAudioEvent.StreakMaintained]: [1889, 549],
  [SpriteAudioEvent.StreakBroken]: [2438, 784],
  [SpriteAudioEvent.AnswerCorrect]: [3222, 827],
  [SpriteAudioEvent.AnswerIncorrect]: [4049, 731],
  [SpriteAudioEvent.VoiceRecordingStart]: [4780, 1100],
  [SpriteAudioEvent.VoiceRecordingStop]: [5880, 1091],
  [SpriteAudioEvent.VoiceResponseReceived]: [6971, 290],
  [SpriteAudioEvent.ToastSuccess]: [7261, 191],
  [SpriteAudioEvent.ToastInfo]: [7452, 43],
  [SpriteAudioEvent.ToastWarning]: [7495, 724],
  [SpriteAudioEvent.ActivityStart]: [8219, 225],
  [SpriteAudioEvent.ActivityComplete]: [8444, 1002],
  [SpriteAudioEvent.LessonStart]: [9446, 811],
  [SpriteAudioEvent.LessonComplete]: [10257, 909],
  [SpriteAudioEvent.XPGain]: [11166, 522],
  [SpriteAudioEvent.ErrorSubtle]: [11688, 64],
  [SpriteAudioEvent.Congrats]: [11752, 1758],
};

// Convert ms to seconds for use-sound
const spriteMapSeconds = Object.fromEntries(
  Object.entries(spriteMap).map(([key, [start, duration]]) => [
    key,
    [start / 1000, duration / 1000],
  ]),
) as any;

/**
 * Hook to play sprite sounds.
 */
export const useSpriteAudioEvents = () => {
  const { volume, isMuted } = useAudioStore();

  const [play, { sound }] = useSound('/audio/sprites/sfx-sprite.mp3', {
    sprite: spriteMapSeconds,
    volume: isMuted ? 0 : volume,
    preload: true,
    // Debug callbacks
    onload: () => console.log('[Audio] ✅ Sprite file loaded successfully'),
    onerror: (err: any) =>
      console.error('[Audio] ❌ Sprite file failed to load:', err?.message || err),
  });

  // Log initial state
  console.log(
    '[Audio] useSpriteAudioEvents initialized. muted:',
    isMuted,
    'volume:',
    volume,
    'sound:',
    !!sound,
  );

  const playSprite = (event: SpriteAudioEvent) => {
    if (isMuted) {
      console.log('[Audio] 🔇 Muted, skipping:', event);
      return;
    }
    if (!sound) {
      console.warn('[Audio] ⚠️ Sound not loaded yet, cannot play:', event);
      return;
    }
    console.log('[Audio] ▶️ Playing sprite:', event, '(vol:', volume, ')');
    try {
      play({ id: event });
    } catch (e: any) {
      console.error('[Audio] ❌ Error playing', event, ':', e?.message || e);
    }
  };

  return { playSprite };
};
