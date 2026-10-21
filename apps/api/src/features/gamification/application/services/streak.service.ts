import { createLogger } from '@/shared/logger/logger.js';

import type { StreakResult } from '@/features/gamification/domain/entities/streak.types.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import type { IDailyActivityRepository } from '@/features/gamification/domain/ports/daily-activity.repository.port.js';
import {
  addDaysUTC,
  calculateStreakBonus,
  calculateStreakFromActivities,
  getStartOfDayUTC,
  isSameDay,
} from '@/features/gamification/application/services/streak-calculator.service.js';

/**
 * How far back the calendar is read when recomputing a streak. A current streak
 * longer than this window would be capped, so the window grows with the user's
 * own record (see `windowStart`).
 */
const STREAK_WINDOW_DAYS = 400;

/**
 * Owns the streak rule.
 *
 * `daily_activities` is the source of truth: every read walks the calendar
 * instead of trusting a counter plus a timestamp, so a missed day, a timezone
 * boundary or a duplicate event cannot drift the number. `UserGamification`
 * keeps a cached `currentStreak`/`longestStreak` for display, written only here.
 */
export class StreakService {
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private userGamificationRepo: IUserGamificationRepository,
    private dailyActivityRepo: IDailyActivityRepository,
    logger?: ReturnType<typeof createLogger>,
  ) {
    this.logger = logger ?? createLogger();
  }

  /**
   * Records `activityDate` (default: now) as a day with activity.
   *
   * Returns the streak after the day is recorded. Calling it twice on the same
   * calendar day is a no-op that pays no bonus, which makes it safe to emit from
   * every touchpoint.
   */
  async recordActivity(userId: string, activityDate: Date = new Date()): Promise<StreakResult> {
    const today = getStartOfDayUTC(activityDate);
    const profile = await this.userGamificationRepo.getOrCreate(userId);
    const previousLongestStreak = profile.longestStreak;
    const history = await this.dailyActivityRepo.getActivityDates(
      userId,
      this.windowStart(today, previousLongestStreak),
    );

    if (history.some((day) => isSameDay(day, today))) {
      const info = calculateStreakFromActivities(history, previousLongestStreak, today);

      this.logger.info(
        `[StreakService] Activity already recorded for ${userId} on ${today.toISOString()}`,
      );

      return {
        currentStreak: info.currentStreak,
        longestStreak: info.longestStreak,
        isNewRecord: false,
        bonusXP: 0,
        streakWasBroken: false,
        activityDate: today,
      };
    }

    const lastRecordedDay = history[history.length - 1];
    const streakWasBroken =
      lastRecordedDay !== undefined && !isSameDay(lastRecordedDay, addDaysUTC(today, -1));

    await this.dailyActivityRepo.recordActivity(userId, today);

    const info = calculateStreakFromActivities([...history, today], previousLongestStreak, today);
    const bonusXP = calculateStreakBonus(info.currentStreak);

    await this.userGamificationRepo.updateStreak(userId, {
      currentStreak: info.currentStreak,
      longestStreak: info.longestStreak,
      lastActivityAt: activityDate,
    });

    this.logger.info(
      `[StreakService] User ${userId}: current=${info.currentStreak}, longest=${info.longestStreak}, bonus=${bonusXP}, broken=${streakWasBroken}`,
    );

    return {
      currentStreak: info.currentStreak,
      longestStreak: info.longestStreak,
      isNewRecord: info.isNewRecord,
      bonusXP,
      streakWasBroken,
      activityDate: today,
    };
  }

  async recordDailyLogin(userId: string, loginDate: Date = new Date()): Promise<StreakResult> {
    return this.recordActivity(userId, loginDate);
  }

  /** First day the calendar must include to reproduce the current streak. */
  private windowStart(today: Date, previousLongestStreak: number): Date {
    const days = Math.max(STREAK_WINDOW_DAYS, previousLongestStreak + 2);
    return addDaysUTC(today, -(days - 1));
  }
}
