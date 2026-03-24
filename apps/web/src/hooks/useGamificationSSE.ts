import { useEffect, useRef, useState } from 'react';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '../stores/gamification.store';

interface XPEarnedEvent {
  type: 'xp_earned';
  amount: number;
  reason: string;
}

interface BadgeEarnedEvent {
  type: 'badge_earned';
  badge: EarnedBadge;
}

interface LevelUpEvent {
  type: 'level_up';
  newLevel: number;
  newLevelTitle: string;
  previousLevel: number;
  totalXP: number;
}

interface StreakUpdatedEvent {
  type: 'streak_updated';
  currentStreak: number;
  longestStreak: number;
}

type SSEEvent = XPEarnedEvent | BadgeEarnedEvent | LevelUpEvent | StreakUpdatedEvent;

export function useGamificationSSE(enabled = true) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const store = useGamificationStore();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const eventSource = new EventSource('/api/gamification/events');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'xp_earned': {
            const { profile } = store;
            if (!profile) break;
            const newTotalXP = profile.totalXP + (data as XPEarnedEvent).amount;
            store.onXPEarned(newTotalXP, (data as XPEarnedEvent).reason);
            break;
          }
          case 'badge_earned':
            store.onBadgeEarned((data as BadgeEarnedEvent).badge);
            break;
          case 'level_up':
            store.onLevelUp(data as LevelUpEvent);
            break;
          case 'streak_updated':
            store.onStreakUpdated(
              (data as StreakUpdatedEvent).currentStreak,
              (data as StreakUpdatedEvent).longestStreak,
            );
            break;
          default:
            console.warn('[GamificationSSE] Unknown event type:', (data as SSEEvent).type);
        }
      } catch (e) {
        console.warn('[GamificationSSE] Failed to parse event:', e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // EventSource auto-reconnects by default
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected };
}
