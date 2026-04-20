import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '../stores/gamification.store';

import { getToken } from '@/services/api-client';
import { logger } from '@/utils/logger';

interface XPEarnedEvent {
  type: 'xp_earned';
  amount: number;
  reason: string;
  version: number;
}

interface BadgeEarnedEvent {
  type: 'badge_earned';
  badge: EarnedBadge;
  version: number;
}

interface LevelUpEvent {
  type: 'level_up';
  newLevel: number;
  newLevelTitle: string;
  previousLevel: number;
  totalXP: number;
  version: number;
}

interface StreakUpdatedEvent {
  type: 'streak_updated';
  currentStreak: number;
  longestStreak: number;
  version: number;
}

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

export function useGamificationSSE(enabled = true) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const store = useGamificationStore();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionVersionRef = useRef(0);

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

  // Fetch fresh gamification state on reconnect
  const fetchFreshState = useCallback(async () => {
    try {
      await store.fetchProfile();
    } catch {
      // Silent fail - will retry on next reconnect
    }
  }, [store]);

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
      connectionVersionRef.current += 1;
      const currentVersion = connectionVersionRef.current;

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
            const data = JSON.parse(event.data);
            const eventType = event.event;

            switch (eventType) {
              case 'xp_earned': {
                const eventData = data as XPEarnedEvent;
                store.onXPEarned(
                  eventData.amount,
                  eventData.reason,
                  eventData.version ?? currentVersion,
                );
                break;
              }
              case 'badge_earned': {
                const eventData = data as BadgeEarnedEvent;
                store.onBadgeEarned(eventData.badge, eventData.version ?? currentVersion);
                break;
              }
              case 'level_up': {
                const eventData = data as LevelUpEvent;
                store.onLevelUp(
                  {
                    newLevel: eventData.newLevel,
                    newLevelTitle: eventData.newLevelTitle,
                    previousLevel: eventData.previousLevel,
                    totalXP: eventData.totalXP,
                  },
                  eventData.version ?? currentVersion,
                );
                break;
              }
              case 'streak_updated': {
                const eventData = data as StreakUpdatedEvent;
                store.onStreakUpdated(
                  eventData.currentStreak,
                  eventData.longestStreak,
                  eventData.version ?? currentVersion,
                );
                break;
              }
              default:
                logger.warn('[GamificationSSE] Unknown event type:', eventType);
            }
          } catch {
            // Silently ignore parse errors
          }
        },
        onerror: () => {
          setIsConnected(false);
          abortControllerRef.current = null;

          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY,
          );
          reconnectAttemptRef.current += 1;

          logger.warn(
            `[GamificationSSE] Connection lost, retrying in ${delay}ms (attempt ${reconnectAttemptRef.current})`,
          );

          if (reconnectAttemptRef.current <= 10) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            logger.error('[GamificationSSE] Max reconnection attempts reached');
          }

          return null;
        },
        onclose: () => {
          setIsConnected(false);
          abortControllerRef.current = null;
        },
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          logger.error('[GamificationSSE] fetchEventSource error:', err);
        }
      });
    };

    connect();

    return () => {
      cleanup();
    };
  }, [enabled, cleanup, fetchFreshState]);

  return { isConnected };
}
