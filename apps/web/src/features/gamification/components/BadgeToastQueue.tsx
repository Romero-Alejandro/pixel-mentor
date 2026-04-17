import { useEffect, useState } from 'react';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '../stores/gamification.store';

import { BadgeEarnedToast } from './BadgeEarnedToast';

export function BadgeToastQueue() {
  const pendingToasts = useGamificationStore((s) => s.pendingToasts);
  const processNextToast = useGamificationStore((s) => s.processNextToast);
  const [current, setCurrent] = useState<EarnedBadge | null>(null);

  // When store has pending toasts and nothing is showing, pop the next one
  useEffect(() => {
    if (!current && pendingToasts.length > 0) {
      const [next] = pendingToasts;
      setCurrent(next);
      // Store has already removed it from pendingToasts via processNextToast
    }
  }, [pendingToasts, current]);

  const handleDismiss = () => {
    setCurrent(null);
    // Trigger processing the next toast from pendingToasts
    processNextToast();
  };

  if (!current) return null;

  return <BadgeEarnedToast badge={current} onDismiss={handleDismiss} />;
}