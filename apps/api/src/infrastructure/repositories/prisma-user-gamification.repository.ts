/**
 * Prisma-based User Gamification Repository.
 *
 * Implements IUserGamificationRepository using Prisma ORM.
 * Handles all database operations for user gamification data.
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';
import { LevelService } from '@/game-engine/level.service.js';

import type {
  IUserGamificationRepository,
  GamificationProfile,
} from '@/domain/ports/gamification-ports.js';

export class PrismaUserGamificationRepository implements IUserGamificationRepository {
  private levelService: LevelService;

  constructor() {
    this.levelService = new LevelService();
  }

  /**
   * Find a user's gamification profile.
   */
  async findByUserId(userId: string): Promise<GamificationProfile | null> {
    const userGamification = await prisma.userGamification.findUnique({
      where: { userId },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });

    if (!userGamification) {
      return null;
    }

    return this.mapToProfile(userGamification);
  }

  /**
   * Get or create a user's gamification profile.
   */
  async getOrCreate(userId: string): Promise<GamificationProfile> {
    let userGamification = await prisma.userGamification.findUnique({
      where: { userId },
      include: {
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });

    if (!userGamification) {
      // Create new gamification record
      userGamification = await prisma.userGamification.create({
        data: {
          userId,
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
        },
        include: {
          badges: {
            include: {
              badge: true,
            },
          },
        },
      });
    }

    return this.mapToProfile(userGamification);
  }

  /**
   * Add XP to a user's account and detect level-ups.
   */
  async addXP(
    userId: string,
    amount: number,
  ): Promise<{ newXP: number; leveledUp: boolean; newLevel?: number; newLevelTitle?: string }> {
    // Ensure user exists
    await this.getOrCreate(userId);

    // Get current state before update
    const before = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!before) {
      throw new Error(`Failed to get or create gamification for user ${userId}`);
    }

    const previousLevel = before.level;
    const newTotalXP = before.totalXP + amount;

    // Calculate new level
    const newLevel = await this.levelService.calculateLevel(newTotalXP);
    const leveledUp = newLevel > previousLevel;
    const newLevelTitle = leveledUp ? this.levelService.getLevelTitle(newLevel) : undefined;

    // Update the user's XP and level
    await prisma.userGamification.update({
      where: { userId },
      data: {
        totalXP: newTotalXP,
        level: newLevel,
        lastActivityAt: new Date(),
      },
    });

    return {
      newXP: newTotalXP,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      newLevelTitle,
    };
  }

  /**
   * Update a user's streak data.
   */
  async updateStreak(userId: string, newStreak: number, longestStreak: number): Promise<void> {
    await prisma.userGamification.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, longestStreak),
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Get level configuration for a specific level.
   */
  async getLevelConfig(
    level: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null> {
    const config = await prisma.levelConfig.findUnique({
      where: { level },
    });

    if (!config) {
      return null;
    }

    return {
      level: config.level,
      title: config.title,
      minXP: config.minXP,
      icon: config.icon,
    };
  }

  /**
   * Get level configuration for the next level.
   */
  async getNextLevelConfig(
    currentLevel: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null> {
    return this.getLevelConfig(currentLevel + 1);
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
      throw new Error(`Badge not found: ${badgeCode}`);
    }

    // Get user's gamification record
    const userGamificationRecord = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!userGamificationRecord) {
      throw new Error(`User gamification record not found for user ${userId}`);
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

    // Award the badge
    await prisma.userBadge.create({
      data: {
        userId,
        badgeId: badge.id,
        userGamificationId: userGamificationRecord.id,
      },
    });

    // Award XP bonus for the badge
    if (badge.xpReward > 0) {
      await this.addXP(userId, badge.xpReward);
    }

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
   * Map database entity to GamificationProfile.
   */
  private async mapToProfile(
    entity: Awaited<ReturnType<typeof prisma.userGamification.findUnique>> & {
      badges: Array<{
        badge: {
          code: string;
          name: string;
          icon: string;
          description: string;
        };
        earnedAt: Date;
      }>;
    },
  ): Promise<GamificationProfile> {
    const currentLevelConfig = await this.getLevelConfig(entity.level);
    const nextLevelConfig = await this.getNextLevelConfig(entity.level);

    const currentMinXP = currentLevelConfig?.minXP ?? 0;
    const nextMinXP = nextLevelConfig?.minXP ?? currentMinXP;
    const xpNeededForNext = nextMinXP - currentMinXP;
    const xpInCurrentLevel = entity.totalXP - currentMinXP;
    const xpProgressPercent =
      xpNeededForNext > 0
        ? Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100))
        : 100;

    return {
      userId: entity.userId,
      level: entity.level,
      levelTitle: currentLevelConfig?.title ?? this.levelService.getLevelTitle(entity.level),
      currentXP: entity.totalXP,
      xpToNextLevel: xpNeededForNext,
      xpProgressPercent,
      streak: entity.currentStreak,
      longestStreak: entity.longestStreak,
      lastActivityAt: entity.lastActivityAt,
      totalBadges: entity.badges.length,
      badges: entity.badges.map((ub) => ({
        code: ub.badge.code,
        name: ub.badge.name,
        icon: ub.badge.icon,
        description: ub.badge.description,
        earnedAt: ub.earnedAt,
      })),
    };
  }
}
