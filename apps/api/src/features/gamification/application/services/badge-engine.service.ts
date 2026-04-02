import { createLogger } from '@/shared/logger/logger.js';

import type {
  BadgeAwardResult,
  BadgeDefinition,
  BadgeProgress,
  UserBadgeStats,
} from '../../domain/entities/badge.types';
import { parseBadgeRules } from './badge-progress.service.js';
import type { BadgeProgressCalculator } from './badge-progress.service.js';

import { getEventBus, type EventBus } from '@/shared/events/event-bus.port.js';
import type { BadgeEarnedPayload, XPChangedPayload } from '@/shared/events/game-events.port.js';
import { GameEngineEvents } from '@/shared/events/game-events.port.js';
import type {
  IBadgeRepository,
  IUserGamificationRepository,
} from '../../domain/ports/gamification.ports';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port';

export class BadgeEngine {
  private eventBus: EventBus;
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private badgeRepo: IBadgeRepository,
    private userGamificationRepo: IUserGamificationRepository,
    private badgeProgressCalc: BadgeProgressCalculator,
    private progressRepo: ProgressRepository,
    private activityAttemptRepo: ActivityAttemptRepository,
    eventBus?: EventBus,
    logger?: ReturnType<typeof createLogger>,
  ) {
    this.eventBus = eventBus ?? getEventBus();
    this.logger = logger ?? createLogger();
  }

  async hasBadge(userId: string, badgeCode: string): Promise<boolean> {
    return this.badgeRepo.hasBadge(userId, badgeCode);
  }

  async checkAndAwardBadges(userId: string, badgeCodes: string[]): Promise<BadgeAwardResult[]> {
    const results: BadgeAwardResult[] = [];

    for (const badgeCode of badgeCodes) {
      const result = await this.awardBadgeIfQualified(userId, badgeCode);
      results.push(result);
    }

    return results;
  }

  private async awardBadgeIfQualified(
    userId: string,
    badgeCode: string,
  ): Promise<BadgeAwardResult> {
    const badge = await this.badgeRepo.findByCode(badgeCode);

    if (!badge) {
      this.logger.warn(`[BadgeEngine] Badge not found: ${badgeCode}`);
      return {
        awarded: false,
        badgeCode,
        badgeName: badgeCode,
        badgeIcon: '❓',
        xpAwarded: 0,
        error: 'Badge not found',
      };
    }

    if (!badge.isActive) {
      this.logger.warn(`[BadgeEngine] Badge is inactive: ${badgeCode}`);
      return {
        awarded: false,
        badgeCode,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        xpAwarded: 0,
        error: 'Badge is inactive',
      };
    }

    if (await this.hasBadge(userId, badgeCode)) {
      this.logger.debug(`[BadgeEngine] User ${userId} already has badge ${badgeCode}`);
      return {
        awarded: false,
        badgeCode,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        xpAwarded: 0,
        error: 'Already earned',
      };
    }

    const rules = parseBadgeRules(badge.rules as unknown as Record<string, unknown>);
    if (!rules) {
      this.logger.warn(`[BadgeEngine] Invalid rules for badge: ${badgeCode}`);
      return {
        awarded: false,
        badgeCode,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        xpAwarded: 0,
        error: 'Invalid badge rules',
      };
    }

    const qualifies = await this.checkQualification(userId, rules);
    if (!qualifies) {
      this.logger.debug(`[BadgeEngine] User ${userId} does not qualify for badge ${badgeCode}`);
      return {
        awarded: false,
        badgeCode,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        xpAwarded: 0,
        error: 'Does not qualify',
      };
    }

    try {
      const { awarded, newTotalXP } = await this.badgeRepo.awardBadgeWithXP(
        userId,
        badgeCode,
        badge.xpReward,
      );

      if (awarded) {
        const totalBadges = await this.badgeRepo.getUserBadgeCount(userId);

        await this.eventBus.emit(GameEngineEvents.BADGE_EARNED, {
          userId,
          badgeCode,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          totalBadges,
        } as BadgeEarnedPayload);

        if (badge.xpReward > 0 && newTotalXP > 0) {
          const previousXP = newTotalXP - badge.xpReward;
          await this.eventBus.emit(GameEngineEvents.XP_CHANGED, {
            userId,
            previousXP: Math.max(0, previousXP),
            newXP: newTotalXP,
            delta: badge.xpReward,
            source: 'BADGE_REWARD',
          } as XPChangedPayload);
        }

        this.logger.info(`[BadgeEngine] Awarded badge ${badgeCode} to user ${userId}`);

        return {
          awarded: true,
          badgeCode,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          xpAwarded: badge.xpReward,
        };
      }

      return {
        awarded: false,
        badgeCode,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        xpAwarded: 0,
        error: 'Already earned',
      };
    } catch (error) {
      this.logger.error(
        { err: error },
        `[BadgeEngine] Error awarding badge ${badgeCode} to user ${userId}`,
      );
      return {
        awarded: false,
        badgeCode,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        xpAwarded: 0,
        error: 'Database error',
      };
    }
  }

  private async checkQualification(
    userId: string,
    rules: { type: string; value: number },
  ): Promise<boolean> {
    switch (rules.type) {
      case 'STREAK': {
        const profileStats = await this.userGamificationRepo.getProfileStats(userId);
        return (profileStats?.currentStreak ?? 0) >= rules.value;
      }

      case 'LEVEL': {
        const profileStats = await this.userGamificationRepo.getProfileStats(userId);
        return (profileStats?.level ?? 1) >= rules.value;
      }

      case 'LESSON_COUNT': {
        const completedLessons = await this.progressRepo.countByUserIdAndStatus(userId, [
          'MASTERED',
          'IN_PROGRESS',
        ]);
        return completedLessons >= rules.value;
      }

      case 'PERFECT_ATTEMPT': {
        const perfectAttempts = await this.activityAttemptRepo.countCorrectFirstAttempts(userId);
        return perfectAttempts >= rules.value;
      }

      default:
        return false;
    }
  }

  async getBadgeProgress(userId: string): Promise<BadgeProgress[]> {
    return this.badgeProgressCalc.getAllBadgeProgress(userId);
  }

  async getSingleBadgeProgress(userId: string, badgeCode: string): Promise<BadgeProgress | null> {
    return this.badgeProgressCalc.calculateBadgeProgress(userId, badgeCode);
  }

  async getAllBadgeDefinitions(): Promise<BadgeDefinition[]> {
    return this.badgeRepo.getActiveBadges();
  }

  async getBadgeStats(userId: string): Promise<UserBadgeStats> {
    const stats = await this.badgeRepo.getUserBadgeStats(userId);
    return {
      totalEarned: stats.totalEarned,
      totalXPFromBadges: stats.totalXPFromBadges,
      byType: stats.byType as UserBadgeStats['byType'],
    };
  }

  async getNearCompletionBadges(userId: string, minPercent = 50): Promise<BadgeProgress[]> {
    return this.badgeProgressCalc.getNearCompletionBadges(userId, minPercent);
  }

  async checkAndAwardAllApplicableBadges(userId: string): Promise<BadgeAwardResult[]> {
    const badges = await this.badgeRepo.getActiveBadges();
    const badgeCodes = badges.map((b) => b.code);
    const results = await this.checkAndAwardBadges(userId, badgeCodes);
    return results.filter((r) => r.awarded);
  }
}

let badgeEngineInstance: BadgeEngine | null = null;

export function getBadgeEngine(): BadgeEngine {
  if (!badgeEngineInstance) {
    throw new Error('BadgeEngine not initialized. Call initializeBadgeEngine first.');
  }
  return badgeEngineInstance;
}

export function initializeBadgeEngine(
  badgeRepo: IBadgeRepository,
  userGamificationRepo: IUserGamificationRepository,
  badgeProgressCalc: BadgeProgressCalculator,
  progressRepo: ProgressRepository,
  activityAttemptRepo: ActivityAttemptRepository,
): BadgeEngine {
  badgeEngineInstance = new BadgeEngine(
    badgeRepo,
    userGamificationRepo,
    badgeProgressCalc,
    progressRepo,
    activityAttemptRepo,
  );
  return badgeEngineInstance;
}

export function resetBadgeEngine(): void {
  badgeEngineInstance = null;
}
