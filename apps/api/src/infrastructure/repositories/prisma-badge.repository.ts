/**
 * Prisma-based Badge Repository.
 *
 * Implements IBadgeRepository using Prisma ORM.
 * Handles all database operations for badge data.
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';

import type { IBadgeRepository } from '@/domain/ports/gamification-ports.js';

export class PrismaBadgeRepository implements IBadgeRepository {
  /**
   * Find all active badges.
   */
  async findAll(): Promise<
    Array<{
      code: string;
      name: string;
      description: string;
      icon: string;
      xpReward: number;
      rules: Record<string, unknown>;
    }>
  > {
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
      rules: badge.rules as Record<string, unknown>,
    }));
  }

  /**
   * Find a badge by its code.
   */
  async findByCode(code: string): Promise<{
    code: string;
    name: string;
    icon: string;
    xpReward: number;
  } | null> {
    const badge = await prisma.badge.findUnique({
      where: { code },
    });

    if (!badge) {
      return null;
    }

    return {
      code: badge.code,
      name: badge.name,
      icon: badge.icon,
      xpReward: badge.xpReward,
    };
  }

  /**
   * Award a badge to a user.
   * Returns true if the badge was newly awarded, false if already owned.
   */
  async awardBadge(userId: string, badgeCode: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode },
    });

    if (!badge) {
      return false;
    }

    // Check if user already has this badge
    const existingBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existingBadge) {
      return false; // Already awarded
    }

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

    // Award the badge
    await prisma.userBadge.create({
      data: {
        userId,
        badgeId: badge.id,
        userGamificationId: userGamification.id,
      },
    });

    return true;
  }

  /**
   * Get all badges earned by a user.
   */
  async getUserBadges(userId: string): Promise<
    Array<{
      code: string;
      name: string;
      icon: string;
      description: string;
      earnedAt: Date;
    }>
  > {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });

    return userBadges.map((ub) => ({
      code: ub.badge.code,
      name: ub.badge.name,
      icon: ub.badge.icon,
      description: ub.badge.description,
      earnedAt: ub.earnedAt,
    }));
  }

  /**
   * Check if a user has a specific badge.
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
}
