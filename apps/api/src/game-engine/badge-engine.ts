/**
 * Badge Engine - Manages badge-related logic for the gamification system.
 *
 * This class is responsible for:
 * - Checking if users qualify for badges based on badge rules
 * - Awarding badges idempotently (no duplicates)
 * - Emitting BADGE_EARNED events after successful persistence
 * - Providing badge progress information
 */

import pino from 'pino';

import type {
  BadgeAwardResult,
  BadgeDefinition,
  BadgeProgress,
  UserBadgeStats,
} from './badge-types.js';
import { calculateBadgeProgress, getAllBadgeProgress, parseBadgeRules } from './badge-progress.js';

import { getEventBus, type EventBus } from '@/events/event-bus.js';
import type { BadgeEarnedPayload, XPChangedPayload } from '@/events/game-events.js';
import { GameEngineEvents } from '@/events/game-events.js';
import { prisma } from '@/infrastructure/adapters/database/client.js';

/**
 * Badge Engine - Central service for badge management.
 *
 * Provides methods for:
 * - Checking and awarding badges
 * - Querying badge progress
 * - Getting badge statistics
 */
export class BadgeEngine {
  private eventBus: EventBus;
  private readonly logger: pino.Logger;

  constructor(eventBus?: EventBus, logger?: pino.Logger) {
    this.eventBus = eventBus ?? getEventBus();
    this.logger = logger ?? pino({ level: 'silent' });
  }

  /**
   * Check if a user has a specific badge.
   *
   * @param userId - The user ID
   * @param badgeCode - The badge code to check
   * @returns true if the user has the badge, false otherwise
   */
  async hasBadge(userId: string, badgeCode: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode },
    });

    if (!badge) {
      return false;
    }

    const userBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    return userBadge !== null;
  }

  /**
   * Check and award multiple badges to a user.
   * Awards are idempotent - badges already earned will not be re-awarded.
   *
   * @param userId - The user ID to award badges to
   * @param badgeCodes - Array of badge codes to check and award
   * @returns Array of award results for each badge
   */
  async checkAndAwardBadges(userId: string, badgeCodes: string[]): Promise<BadgeAwardResult[]> {
    const results: BadgeAwardResult[] = [];

    for (const badgeCode of badgeCodes) {
      const result = await this.awardBadgeIfQualified(userId, badgeCode);
      results.push(result);
    }

    return results;
  }

  /**
   * Award a single badge if the user qualifies.
   * This is the internal method used by checkAndAwardBadges.
   *
   * @param userId - The user ID
   * @param badgeCode - The badge code to award
   * @returns BadgeAwardResult
   */
  private async awardBadgeIfQualified(
    userId: string,
    badgeCode: string,
  ): Promise<BadgeAwardResult> {
    // Check if badge exists
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode },
    });

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

    // Check if user already has the badge (idempotent check)
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

    // Parse badge rules to check qualification
    const rules = parseBadgeRules(badge.rules as Record<string, unknown>);
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

    // Check if user qualifies for the badge
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

    // Award the badge (with transaction for atomicity)
    try {
      const awardResult = await this.persistBadgeAward(userId, badge);
      if (awardResult.success) {
        // Emit events after successful persistence
        await this.emitBadgeEvents(userId, badge, awardResult.newTotalXP ?? 0);

        this.logger.info(`[BadgeEngine] Awarded badge ${badgeCode} to user ${userId}`);

        return {
          awarded: true,
          badgeCode,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          xpAwarded: badge.xpReward,
        };
      } else {
        return {
          awarded: false,
          badgeCode,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          xpAwarded: 0,
          error: awardResult.error ?? 'Unknown error',
        };
      }
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

  /**
   * Check if a user qualifies for a badge based on its rules.
   */
  private async checkQualification(
    userId: string,
    rules: { type: string; value: number },
  ): Promise<boolean> {
    // Get user's current stats
    const userGamification = await prisma.userGamification.findUnique({
      where: { userId },
    });

    switch (rules.type) {
      case 'STREAK': {
        const currentStreak = userGamification?.currentStreak ?? 0;
        return currentStreak >= rules.value;
      }

      case 'LEVEL': {
        const currentLevel = userGamification?.level ?? 1;
        return currentLevel >= rules.value;
      }

      case 'LESSON_COUNT': {
        const completedLessons = await prisma.userProgress.count({
          where: {
            userId,
            status: { in: ['MASTERED', 'IN_PROGRESS'] },
          },
        });
        return completedLessons >= rules.value;
      }

      case 'PERFECT_ATTEMPT': {
        // Perfect attempt badge is awarded on first correct first attempt
        const perfectAttempts = await prisma.activityAttempt.count({
          where: {
            userId,
            correct: true,
            attemptNo: 1,
          },
        });
        return perfectAttempts >= rules.value;
      }

      default:
        return false;
    }
  }

  /**
   * Persist the badge award to the database.
   * Uses a transaction to ensure atomicity.
   */
  private async persistBadgeAward(
    userId: string,
    badge: { id: string; code: string; name: string; icon: string; xpReward: number },
  ): Promise<{ success: boolean; newTotalXP?: number; error?: string }> {
    // Get or create user gamification record
    let userGamification = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!userGamification) {
      userGamification = await prisma.userGamification.create({
        data: {
          userId,
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
        },
      });
    }

    // Use transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Check again within transaction to prevent race conditions
      const existingBadge = await tx.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      if (existingBadge) {
        return { success: false, error: 'Already earned' };
      }

      // Award the badge
      await tx.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          userGamificationId: userGamification!.id,
        },
      });

      // Award XP if there's a reward
      let newTotalXP = userGamification!.totalXP;
      if (badge.xpReward > 0) {
        await tx.userGamification.update({
          where: { userId },
          data: {
            totalXP: { increment: badge.xpReward },
          },
        });
        newTotalXP += badge.xpReward;
      }

      return { success: true, newTotalXP };
    });

    return result;
  }

  /**
   * Emit events after badge award.
   * BADGE_EARNED is emitted first, then XP_CHANGED if XP was awarded.
   */
  private async emitBadgeEvents(
    userId: string,
    badge: { code: string; name: string; icon: string; xpReward: number },
    newTotalXP: number,
  ): Promise<void> {
    // Get total badges count after award
    const totalBadges = await prisma.userBadge.count({
      where: { userId },
    });

    // Emit BADGE_EARNED event
    const badgePayload: BadgeEarnedPayload = {
      userId,
      badgeCode: badge.code,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      totalBadges,
    };

    await this.eventBus.emit(GameEngineEvents.BADGE_EARNED, badgePayload);

    // Emit XP_CHANGED event if XP was awarded
    if (badge.xpReward > 0 && newTotalXP > 0) {
      const previousXP = newTotalXP - badge.xpReward;

      const xpPayload: XPChangedPayload = {
        userId,
        previousXP,
        newXP: newTotalXP,
        delta: badge.xpReward,
        source: 'BADGE_REWARD',
      };

      await this.eventBus.emit(GameEngineEvents.XP_CHANGED, xpPayload);
    }
  }

  /**
   * Get badge progress for all badges for a user.
   *
   * @param userId - The user ID
   * @returns Array of BadgeProgress for all active badges
   */
  async getBadgeProgress(userId: string): Promise<BadgeProgress[]> {
    return getAllBadgeProgress(userId);
  }

  /**
   * Get progress toward a specific badge.
   *
   * @param userId - The user ID
   * @param badgeCode - The badge code to get progress for
   * @returns BadgeProgress or null if badge not found
   */
  async getSingleBadgeProgress(userId: string, badgeCode: string): Promise<BadgeProgress | null> {
    return calculateBadgeProgress(userId, badgeCode);
  }

  /**
   * Get all active badge definitions.
   *
   * @returns Array of BadgeDefinition
   */
  async getAllBadgeDefinitions(): Promise<BadgeDefinition[]> {
    const badges = await prisma.badge.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return badges.map((badge) => ({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      xpReward: badge.xpReward,
      rules: parseBadgeRules(badge.rules as Record<string, unknown>) ?? {
        type: 'LESSON_COUNT',
        value: 0,
      },
      isActive: badge.isActive,
    }));
  }

  /**
   * Get badge statistics for a user.
   *
   * @param userId - The user ID
   * @returns UserBadgeStats
   */
  async getBadgeStats(userId: string): Promise<UserBadgeStats> {
    const badges = await prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
    });

    const byType: Record<string, number> = {
      LESSON_COUNT: 0,
      STREAK: 0,
      LEVEL: 0,
      PERFECT_ATTEMPT: 0,
    };

    let totalXPFromBadges = 0;

    for (const ub of badges) {
      const rules = parseBadgeRules(ub.badge.rules as Record<string, unknown>);
      if (rules) {
        byType[rules.type] = (byType[rules.type] ?? 0) + 1;
      }
      totalXPFromBadges += ub.badge.xpReward;
    }

    return {
      totalEarned: badges.length,
      totalXPFromBadges,
      byType: byType as UserBadgeStats['byType'],
    };
  }

  /**
   * Get badges that are close to being earned (>= 50% progress).
   *
   * @param userId - The user ID
   * @param minPercent - Minimum percentage (default: 50)
   * @returns Array of BadgeProgress near completion
   */
  async getNearCompletionBadges(userId: string, minPercent = 50): Promise<BadgeProgress[]> {
    const allProgress = await getAllBadgeProgress(userId);
    return allProgress.filter((p) => !p.earned && p.percent >= minPercent);
  }

  /**
   * Check and award all applicable badges for a user based on current stats.
   * This is typically called after significant events like lesson completion,
   * level up, or streak update.
   *
   * @param userId - The user ID
   * @returns Array of newly awarded badges
   */
  async checkAndAwardAllApplicableBadges(userId: string): Promise<BadgeAwardResult[]> {
    // Get all active badges
    const badges = await prisma.badge.findMany({
      where: { isActive: true },
    });

    const badgeCodes = badges.map((b) => b.code);
    const results = await this.checkAndAwardBadges(userId, badgeCodes);

    // Return only newly awarded badges
    return results.filter((r) => r.awarded);
  }
}

// Singleton instance
let badgeEngineInstance: BadgeEngine | null = null;

/**
 * Get the global BadgeEngine instance.
 */
export function getBadgeEngine(): BadgeEngine {
  if (!badgeEngineInstance) {
    badgeEngineInstance = new BadgeEngine();
  }
  return badgeEngineInstance;
}

/**
 * Reset the BadgeEngine instance (primarily for testing).
 */
export function resetBadgeEngine(): void {
  badgeEngineInstance = null;
}
