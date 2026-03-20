/**
 * SSE route for real-time gamification events.
 *
 * Pushes XP changes, badge awards, level ups, and streak updates
 * to connected clients via Server-Sent Events.
 */

import { Router, type Request, type Response } from 'express';
import type pino from 'pino';

import { getEventBus } from '@/events/event-bus';
import { GameEngineEvents } from '@/events/game-events';
import type {
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedPayload,
} from '@/events/game-events';

interface GamificationSSERequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  logger?: pino.Logger;
}

// ===== SSE Event Types (frontend-friendly shapes) =====

interface XPEarnedSSEEvent {
  type: 'xp_earned';
  amount: number;
  newTotal: number;
  reason: string;
}

interface BadgeEarnedSSEEvent {
  type: 'badge_earned';
  badge: {
    code: string;
    name: string;
    icon: string;
    xpReward: number;
  };
}

interface LevelUpSSEEvent {
  type: 'level_up';
  newLevel: number;
  newLevelTitle: string;
  previousLevel: number;
}

interface StreakUpdatedSSEEvent {
  type: 'streak_updated';
  currentStreak: number;
  longestStreak: number;
}

type GamificationSSEEvent =
  | XPEarnedSSEEvent
  | BadgeEarnedSSEEvent
  | LevelUpSSEEvent
  | StreakUpdatedSSEEvent;

// ===== SSE helpers =====

const HEARTBEAT_INTERVAL_MS = 30_000;

function writeSSE(res: Response, event: GamificationSSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function writeHeartbeat(res: Response): void {
  res.write(':heartbeat\n\n');
}

// ===== Route Factory =====

export function createGamificationEventsRouter(logger?: pino.Logger): Router {
  const router = Router();

  router.get('/events', (req: GamificationSSERequest, res: Response): void => {
    const userId = req.user!.id;
    const log = logger ?? req.logger;

    log?.info(`[GamificationSSE] Client connected: ${userId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send connection confirmation
    res.write(':connected\n\n');

    const eventBus = getEventBus();
    const unsubscribers: Array<() => void> = [];

    // --- XP_CHANGED ---
    unsubscribers.push(
      eventBus.subscribe<XPChangedPayload>(GameEngineEvents.XP_CHANGED, (payload) => {
        if (payload.userId !== userId) return;
        writeSSE(res, {
          type: 'xp_earned',
          amount: payload.delta,
          newTotal: payload.newXP,
          reason: payload.source,
        });
      }),
    );

    // --- BADGE_EARNED ---
    unsubscribers.push(
      eventBus.subscribe<BadgeEarnedPayload>(GameEngineEvents.BADGE_EARNED, (payload) => {
        if (payload.userId !== userId) return;
        writeSSE(res, {
          type: 'badge_earned',
          badge: {
            code: payload.badgeCode,
            name: payload.badgeName,
            icon: payload.badgeIcon,
            xpReward: 0, // Badge xp reward not carried in event payload
          },
        });
      }),
    );

    // --- LEVEL_UP ---
    unsubscribers.push(
      eventBus.subscribe<LevelUpPayload>(GameEngineEvents.LEVEL_UP, (payload) => {
        if (payload.userId !== userId) return;
        writeSSE(res, {
          type: 'level_up',
          newLevel: payload.newLevel,
          newLevelTitle: payload.newLevelTitle,
          previousLevel: payload.previousLevel,
        });
      }),
    );

    // --- STREAK_UPDATED ---
    unsubscribers.push(
      eventBus.subscribe<StreakUpdatedPayload>(GameEngineEvents.STREAK_UPDATED, (payload) => {
        if (payload.userId !== userId) return;
        writeSSE(res, {
          type: 'streak_updated',
          currentStreak: payload.currentStreak,
          longestStreak: payload.longestStreak,
        });
      }),
    );

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => writeHeartbeat(res), HEARTBEAT_INTERVAL_MS);

    // Cleanup on client disconnect
    const cleanup = (): void => {
      clearInterval(heartbeat);
      for (const unsub of unsubscribers) {
        unsub();
      }
      log?.info(`[GamificationSSE] Client disconnected: ${userId}`);
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  });

  return router;
}
