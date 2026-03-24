import { useEffect, useRef } from 'react';

import { useGamificationStore } from '@/stores/gamification.store';
import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';

export const useStreakAudio = () => {
  const { profile } = useGamificationStore();
  const streak = profile?.currentStreak ?? 0;
  const { playSprite } = useAudio();
  const prevStreak = useRef(streak);

  useEffect(() => {
    if (streak > prevStreak.current) {
      playSprite(SpriteAudioEvent.StreakMaintained);
      prevStreak.current = streak;
    }
  }, [streak, playSprite]);
};
