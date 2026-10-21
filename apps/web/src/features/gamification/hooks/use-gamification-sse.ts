import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';
import type { EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '@/features/gamification/stores/gamification.store';

import { getToken } from '@/services/api-client';
import { logger } from '@/utils/logger';

interface XPEarnedEvent {
  type: 'xp_earned';
  /** XP added by this award (`delta`). */
  amount: number;
  /** Balance after the award; this is what the profile shows. */
  newTotal: number;
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

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

export function useGamificationSSE(enabled = true) {
  const abortControllerRef = useRef<AbortController | null>(null);
  // Select only stable action references — never the whole store.
  // Subscribing to the whole store re-renders on ANY state change and,
  // combined with the connect effect below, causes an infinite reconnect loop.
  const fetchProfile = useGamificationStore((s) => s.fetchProfile);
  const onXPEarned = useGamificationStore((s) => s.onXPEarned);
  const onBadgeEarned = useGamificationStore((s) => s.onBadgeEarned);
  const onLevelUp = useGamificationStore((s) => s.onLevelUp);
  const onStreakUpdated = useGamificationStore((s) => s.onStreakUpdated);
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

  // Fetch fresh gamification state on reconnect
  const fetchFreshState = useCallback(async () => {
    try {
      await fetchProfile();
    } catch {
      // Silent fail - will retry on next reconnect
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    const connect = () => {
      const token = getToken();
      if (!token) {
        logger.error('[GamificationSSE] No auth token available, cannot connect');
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
          await fetchFreshState();
        },
        onmessage: (event: EventSourceMessage) => {
          try {
            const data = JSON.parse(event.data) as { type?: string };
            // The server names the event (`event: xp_earned`); the `type` field
            // inside the JSON is the fallback for clients that lose the name.
            const eventType = event.event || data.type;

            switch (eventType) {
              case 'xp_earned': {
                const eventData = data as XPEarnedEvent;
                // `amount` is the delta; the profile shows the new balance.
                onXPEarned(eventData.newTotal, eventData.reason);
                break;
              }
              case 'badge_earned': {
                const eventData = data as BadgeEarnedEvent;
                onBadgeEarned(eventData.badge);
                break;
              }
              case 'level_up': {
                const eventData = data as LevelUpEvent;
                onLevelUp({
                  newLevel: eventData.newLevel,
                  newLevelTitle: eventData.newLevelTitle,
                  previousLevel: eventData.previousLevel,
                  totalXP: eventData.totalXP,
                });
                break;
              }
              case 'streak_updated': {
                const eventData = data as StreakUpdatedEvent;
                onStreakUpdated(eventData.currentStreak, eventData.longestStreak);
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
  }, [enabled, cleanup, fetchFreshState, onXPEarned, onBadgeEarned, onLevelUp, onStreakUpdated]);

  return { isConnected };
}
