/**
 * Announces that the user showed up today.
 *
 * Streaks are derived from the `daily_activities` calendar, so this event is
 * the only thing a touchpoint has to emit: the engine records the day, recomputes
 * the streak and pays the daily bonus. It is idempotent per calendar day, which
 * is why several touchpoints (login, lesson completion) can emit it safely.
 *
 * Gamification must never break authentication or lesson completion, so the
 * failure is swallowed here instead of at every call site.
 */

import { getEventBus } from '@/shared/events/event-bus.js';
import { GameDomainEvents, type DailyLoginPayload } from '@/shared/events/game-events.js';

export async function emitDailyLogin(userId: string, at: Date = new Date()): Promise<void> {
  try {
    await getEventBus().emit<DailyLoginPayload>(GameDomainEvents.DAILY_LOGIN, {
      userId,
      loginDate: at,
    });
  } catch {
    // Deliberately silent: the caller's own operation already succeeded.
  }
}
