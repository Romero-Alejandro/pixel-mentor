import { createLogger } from '@/shared/logger/logger.js';

import type { StreakResult } from '../../domain/entities/streak.types';
import type { IUserGamificationRepository } from '../../domain/ports/gamification.ports';
import type { IDailyActivityRepository } from '../../domain/ports/daily-activity.repository.port';
import {
  calculateStreakBonus,
  isSameDay,
  isStreakBroken,
  getStartOfDayUTC,
} from './streak-calculator.service.js';

export interface IClock {
  now(): Date;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export class StreakService {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly clock: IClock;

  constructor(
    private userGamificationRepo: IUserGamificationRepository,
    private dailyActivityRepo: IDailyActivityRepository,
    logger?: ReturnType<typeof createLogger>,
    clock?: IClock,
  ) {
    this.logger = logger ?? createLogger();
    this.clock = clock ?? new SystemClock();
  }

  async recordActivity(userId: string, activityDate: Date = new Date()): Promise<StreakResult> {
    const now = new Date(activityDate);
    const today = getStartOfDayUTC(now);

    this.logger.info(
      `[StreakService] Recording activity for user ${userId} on ${today.toISOString()}`,
    );

    const profile = await this.userGamificationRepo.getOrCreate(userId);
    const previousLongestStreak = profile.longestStreak;

    let streakWasBroken = false;
    let newStreak = 1;

    if (profile.lastActivityAt) {
      streakWasBroken = isStreakBroken(profile.lastActivityAt, now);

      if (streakWasBroken) {
        this.logger.info(`[StreakService] Streak broken for user ${userId}, resetting to 1`);
        newStreak = 1;
      } else {
        if (isSameDay(profile.lastActivityAt, now)) {
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

        const lastActivityDay = getStartOfDayUTC(profile.lastActivityAt);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysDiff = Math.floor((today.getTime() - lastActivityDay.getTime()) / msPerDay);

        if (daysDiff === 1) {
          newStreak = profile.streak + 1;
          this.logger.info(
            `[StreakService] Consecutive day for user ${userId}, streak: ${newStreak}`,
          );
        } else if (daysDiff > 1) {
          streakWasBroken = true;
          newStreak = 1;
          this.logger.info(`[StreakService] Gap detected for user ${userId}, resetting to 1`);
        } else {
          newStreak = profile.streak;
        }
      }
    }

    const newLongestStreak = Math.max(newStreak, profile.longestStreak);
    const isNewRecord = newStreak > previousLongestStreak;
    const bonusXP = calculateStreakBonus(newStreak);

    await this.userGamificationRepo.updateStreak(userId, {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastActivityAt: now,
    });

    await this.dailyActivityRepo.recordActivity(userId, today);

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

  async getCurrentStreak(userId: string): Promise<number> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    if (!profile || !profile.lastActivityAt) {
      return 0;
    }

    const broken = isStreakBroken(profile.lastActivityAt, this.clock.now());
    if (broken) {
      return 0;
    }

    return profile.streak;
  }

  async getLongestStreak(userId: string): Promise<number> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    return profile?.longestStreak ?? 0;
  }

  async isStreakActive(userId: string): Promise<boolean> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    if (!profile || !profile.lastActivityAt) {
      return false;
    }

    return !isStreakBroken(profile.lastActivityAt, this.clock.now());
  }

  async breakStreak(userId: string): Promise<void> {
    this.logger.info(`[StreakService] Breaking streak for user ${userId}`);
    await this.userGamificationRepo.breakStreak(userId);
  }

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

  async recordDailyLogin(userId: string, loginDate: Date = new Date()): Promise<StreakResult> {
    return this.recordActivity(userId, loginDate);
  }
}
