/**
 * Streak Service - Manages user streak tracking.
 *
 * This service handles:
 * - Tracking daily logins and calculating streaks
 * - Determining if a day counts toward streak (once per 24h window)
 * - Resetting streak if user misses a day
 * - Timezone handling (uses UTC)
 */

import pino from 'pino';

import type { StreakResult } from './streak.types';
import {
  calculateStreakBonus,
  isSameDay,
  isStreakBroken,
  getStartOfDayUTC,
} from './streak-calculator';

import { prisma } from '@/infrastructure/adapters/database/client.js';
import type { IUserGamificationRepository } from '@/domain/ports/gamification-ports.js';

/**
 * Clock interface for time-dependent operations.
 * Allows for deterministic testing.
 */
export interface IClock {
  now(): Date;
}

/**
 * Default clock that returns the current time.
 */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export class StreakService {
  private readonly logger: pino.Logger;
  private readonly clock: IClock;

  constructor(
    private userGamificationRepo: IUserGamificationRepository,
    logger?: pino.Logger,
    clock?: IClock,
  ) {
    this.logger = logger ?? pino({ level: 'silent' });
    this.clock = clock ?? new SystemClock();
  }

  /**
   * Record a daily activity for a user.
   * This should be called when a user completes any learning activity.
   *
   * @param userId - The user's ID
   * @param activityDate - The date of the activity (defaults to now)
   * @returns StreakResult with updated streak information
   */
  async recordActivity(userId: string, activityDate: Date = new Date()): Promise<StreakResult> {
    const now = new Date(activityDate);
    const today = getStartOfDayUTC(now);

    this.logger.info(
      `[StreakService] Recording activity for user ${userId} on ${today.toISOString()}`,
    );

    // Get or create gamification profile
    const profile = await this.userGamificationRepo.getOrCreate(userId);
    const previousLongestStreak = profile.longestStreak;

    // Check if streak is broken (more than 25 hours since last activity)
    let streakWasBroken = false;
    let newStreak = 1;

    if (profile.lastActivityAt) {
      streakWasBroken = isStreakBroken(profile.lastActivityAt, now);

      if (streakWasBroken) {
        // Streak is broken, reset to 1
        this.logger.info(`[StreakService] Streak broken for user ${userId}, resetting to 1`);
        newStreak = 1;
      } else {
        // Check if this is a new day (don't double count)
        if (isSameDay(profile.lastActivityAt, now)) {
          // Already recorded activity today, no change to streak
          this.logger.info(`[StreakService] Activity already recorded today for user ${userId}`);
          return {
            currentStreak: profile.streak,
            longestStreak: profile.longestStreak,
            isNewRecord: false,
            bonusXP: 0,
            streakWasBroken: false,
            activityDate: today,
          };
        }

        // Check if consecutive day
        const lastActivityDay = getStartOfDayUTC(profile.lastActivityAt);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysDiff = Math.floor((today.getTime() - lastActivityDay.getTime()) / msPerDay);

        if (daysDiff === 1) {
          // Consecutive day - increment streak
          newStreak = profile.streak + 1;
          this.logger.info(
            `[StreakService] Consecutive day for user ${userId}, streak: ${newStreak}`,
          );
        } else if (daysDiff > 1) {
          // Gap in activity - streak broken
          streakWasBroken = true;
          newStreak = 1;
          this.logger.info(`[StreakService] Gap detected for user ${userId}, resetting to 1`);
        } else {
          // Same day - no change
          newStreak = profile.streak;
        }
      }
    }

    // Calculate if this is a new record
    const newLongestStreak = Math.max(newStreak, profile.longestStreak);
    const isNewRecord = newStreak > previousLongestStreak;

    // Calculate bonus XP
    const bonusXP = calculateStreakBonus(newStreak);

    // Update database
    await prisma.userGamification.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActivityAt: now,
      },
    });

    // Save daily activity record for streak history
    await prisma.dailyActivity.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {},
      create: {
        userId,
        date: today,
      },
    });

    this.logger.info(
      `[StreakService] Updated streak for user ${userId}: current=${newStreak}, longest=${newLongestStreak}, bonus=${bonusXP}`,
    );

    return {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      isNewRecord,
      bonusXP,
      streakWasBroken,
      activityDate: today,
    };
  }

  /**
   * Get the user's current streak count.
   *
   * @param userId - The user's ID
   * @returns The current streak count (0 if no activity)
   */
  async getCurrentStreak(userId: string): Promise<number> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    if (!profile || !profile.lastActivityAt) {
      return 0;
    }

    // Check if streak is still active
    const broken = isStreakBroken(profile.lastActivityAt, this.clock.now());
    if (broken) {
      // Streak has expired
      return 0;
    }

    return profile.streak;
  }

  /**
   * Get the user's longest streak ever achieved.
   *
   * @param userId - The user's ID
   * @returns The longest streak count (0 if no activity)
   */
  async getLongestStreak(userId: string): Promise<number> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    return profile?.longestStreak ?? 0;
  }

  /**
   * Check if the user's streak is still active.
   *
   * @param userId - The user's ID
   * @returns True if the streak is active (activity within 25 hours)
   */
  async isStreakActive(userId: string): Promise<boolean> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    if (!profile || !profile.lastActivityAt) {
      return false;
    }

    return !isStreakBroken(profile.lastActivityAt, this.clock.now());
  }

  /**
   * Force break a user's streak.
   * Use this for administrative actions or when resetting progress.
   *
   * @param userId - The user's ID
   */
  async breakStreak(userId: string): Promise<void> {
    this.logger.info(`[StreakService] Breaking streak for user ${userId}`);

    await prisma.userGamification.update({
      where: { userId },
      data: {
        currentStreak: 0,
        lastActivityAt: null,
      },
    });
  }

  /**
   * Get detailed streak info for a user.
   * Useful for displaying streak status in the UI.
   *
   * @param userId - The user's ID
   * @returns StreakResult with all streak information
   */
  async getStreakInfo(userId: string): Promise<StreakResult | null> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    if (!profile) {
      return null;
    }

    const streakBroken = profile.lastActivityAt
      ? isStreakBroken(profile.lastActivityAt, this.clock.now())
      : true;

    const currentStreak = streakBroken ? 0 : profile.streak;
    const isNewRecord = currentStreak > profile.longestStreak;
    const bonusXP = calculateStreakBonus(currentStreak);

    return {
      currentStreak,
      longestStreak: profile.longestStreak,
      isNewRecord,
      bonusXP,
      streakWasBroken: streakBroken,
      activityDate: profile.lastActivityAt ?? this.clock.now(),
    };
  }

  /**
   * Record a daily login (convenience method for DAILY_LOGIN events).
   * This is a simplified version of recordActivity for login events.
   *
   * @param userId - The user's ID
   * @returns StreakResult with updated streak information
   */
  async recordDailyLogin(userId: string, loginDate: Date = new Date()): Promise<StreakResult> {
    return this.recordActivity(userId, loginDate);
  }
}
