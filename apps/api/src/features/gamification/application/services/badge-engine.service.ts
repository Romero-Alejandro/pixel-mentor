/**
 * BadgeEngine — read side of the badge system.
 *
 * Badges are awarded by BadgeAwardService from declarative `Badge.rules`.
 * This service only answers questions about badges: what exists, what a user
 * owns, and how close they are to the next one.
 *
 * There is deliberately no plain `awardBadge` here: writing XP (including a
 * badge's `xpReward`) outside AwardXpService would break the ledger invariant.
 */

import type {
  BadgeDefinition,
  BadgeProgress,
  UserBadgeStats,
} from '@/features/gamification/domain/entities/badge.types.js';
import type { BadgeProgressCalculator } from '@/features/gamification/application/services/badge-progress.service.js';
import type { IBadgeRepository } from '@/features/gamification/domain/ports/gamification.ports.js';

export class BadgeEngine {
  constructor(
    private readonly badgeRepo: IBadgeRepository,
    private readonly badgeProgressCalc: BadgeProgressCalculator,
  ) {}

  async hasBadge(userId: string, badgeCode: string): Promise<boolean> {
    return this.badgeRepo.hasBadge(userId, badgeCode);
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
}
