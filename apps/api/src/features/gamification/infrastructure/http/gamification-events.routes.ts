/**
 * SSE route for real-time gamification events.
 */

import { Router, type Request, type Response } from 'express';
import type pino from 'pino';

import { getEventBus } from '@/shared/events/event-bus.port';
import { GameEngineEvents } from '@/shared/events/game-events.port';
import type {
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedPayload,
} from '@/shared/events/game-events.port';

interface GamificationSSERequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  logger?: pino.Logger;
}

// SSE Event Types
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
  totalXP: number;
}

interface StreakUpdatedSSEEvent {
  type: 'streak_updated';
  currentStreak: number;
  longestStreak: number;
}

export type GamificationSSEEvent =
  | XPEarnedSSEEvent
  | BadgeEarnedSSEEvent
  | LevelUpSSEEvent
  | StreakUpdatedSSEEvent;

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Formats one SSE frame.
 *
 * The `event:` line names the event so the browser (and `fetch-event-source`)
 * exposes it as `message.event`. Without it every frame arrives unnamed and a
 * client that dispatches on the name silently ignores all of them.
 *
 * The `type` field inside the JSON repeats the name on purpose: it keeps the
 * frame self-describing for logs and for clients that only parse the data.
 */
export function formatSSEFrame(event: GamificationSSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function writeSSE(res: Response, event: GamificationSSEEvent): void {
  res.write(formatSSEFrame(event));
}

function writeHeartbeat(res: Response): void {
  res.write(':heartbeat\n\n');
}

export function createGamificationEventsRouter(logger?: pino.Logger): Router {
  const router = Router();

  router.get('/events', (req: GamificationSSERequest, res: Response): void => {
    const userId = req.user!.id;
    const log = logger ?? req.logger;

    log?.info(`[GamificationSSE] Client connected: ${userId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(':connected\n\n');

    const eventBus = getEventBus();
    const unsubscribers: Array<() => void> = [];

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

    unsubscribers.push(
      eventBus.subscribe<BadgeEarnedPayload>(GameEngineEvents.BADGE_EARNED, (payload) => {
        if (payload.userId !== userId) return;
        writeSSE(res, {
          type: 'badge_earned',
          badge: {
            code: payload.badgeCode,
            name: payload.badgeName,
            icon: payload.badgeIcon,
            xpReward: payload.xpReward,
          },
        });
      }),
    );

    unsubscribers.push(
      eventBus.subscribe<LevelUpPayload>(GameEngineEvents.LEVEL_UP, (payload) => {
        if (payload.userId !== userId) return;
        writeSSE(res, {
          type: 'level_up',
          newLevel: payload.newLevel,
          newLevelTitle: payload.newLevelTitle,
          previousLevel: payload.previousLevel,
          totalXP: payload.newTotalXP,
        });
      }),
    );

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

    const heartbeat = setInterval(() => writeHeartbeat(res), HEARTBEAT_INTERVAL_MS);

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
