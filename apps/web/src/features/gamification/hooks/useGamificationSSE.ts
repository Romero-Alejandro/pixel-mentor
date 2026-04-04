import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '../stores/gamification.store';

import { getToken } from '@/services/api-client';

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

const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
const INITIAL_RECONNECT_DELAY = 1000;

export function useGamificationSSE(enabled = true) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const store = useGamificationStore();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    const connect = () => {
      const token = getToken();
      if (!token) {
        console.error('[GamificationSSE] No auth token available, cannot connect');
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      fetchEventSource('/api/gamification/events', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        onopen: async () => {
          setIsConnected(true);
          reconnectAttemptRef.current = 0;
        },
        onmessage: (event: EventSourceMessage) => {
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
            console.error('[GamificationSSE] Failed to parse event:', e);
          }
        },
        onerror: () => {
          setIsConnected(false);
          abortControllerRef.current = null;

          // Exponential backoff reconnection
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY,
          );
          reconnectAttemptRef.current += 1;

          console.warn(
            `[GamificationSSE] Connection lost, retrying in ${delay}ms (attempt ${reconnectAttemptRef.current})`,
          );

          if (reconnectAttemptRef.current <= 10) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('[GamificationSSE] Max reconnection attempts reached');
          }

          // Return a retry delay to stop fetchEventSource from auto-retrying
          // We handle reconnection manually with setTimeout
          return null;
        },
        onclose: () => {
          setIsConnected(false);
          abortControllerRef.current = null;
        },
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('[GamificationSSE] fetchEventSource error:', err);
        }
      });
    };

    connect();

    return () => {
      cleanup();
    };
  }, [enabled, store, cleanup]);

  return { isConnected };
}
