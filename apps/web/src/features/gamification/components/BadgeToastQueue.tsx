import { useEffect, useState } from 'react';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '../stores/gamification.store';

import { BadgeEarnedToast } from './BadgeEarnedToast';

export function BadgeToastQueue() {
  const showBadgeEarned = useGamificationStore((s) => s.showBadgeEarned);
  const badgeData = useGamificationStore((s) => s.badgeData);
  const dismissBadgeEarned = useGamificationStore((s) => s.dismissBadgeEarned);

  const [queue, setQueue] = useState<EarnedBadge[]>([]);
  const [current, setCurrent] = useState<EarnedBadge | null>(null);

  // When store signals a new badge, add it to the queue
  useEffect(() => {
    if (showBadgeEarned && badgeData) {
      setQueue((prev) => [...prev, badgeData]);
      // Clear store signal immediately so the same badge isn't re-queued
      dismissBadgeEarned();
    }
  }, [showBadgeEarned, badgeData, dismissBadgeEarned]);

  // If nothing is showing, pop the next badge from the queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [current, queue]);

  const handleDismiss = () => {
    setCurrent(null);
  };

  if (!current) return null;

  return <BadgeEarnedToast badge={current} onDismiss={handleDismiss} />;
}
