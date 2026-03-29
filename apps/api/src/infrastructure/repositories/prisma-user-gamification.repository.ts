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

    // Fetch level configs in a single batch query to avoid N+1
    const levelsNeeded = [userGamification.level, userGamification.level + 1];
    const levelConfigs = await prisma.levelConfig.findMany({
      where: { level: { in: levelsNeeded } },
    });

    return this.mapToProfile(userGamification, levelConfigs);
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
    // NOTE: Do NOT update lastActivityAt here — only StreakService.recordActivity()
    // should manage that field. Updating it here corrupts streak tracking because
    // any XP award (lesson completion, badge, perfect attempt) would count as
    // a streak activity, creating phantom days.
    await prisma.userGamification.update({
      where: { userId },
      data: {
        totalXP: newTotalXP,
        level: newLevel,
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
    // Fetch badge and user gamification in parallel
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode },
    });

    if (!badge) {
      throw new Error(`Badge not found: ${badgeCode}`);
    }

    const userGamification = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!userGamification) {
      throw new Error(`User gamification record not found for user ${userId}`);
    }

    // Use transaction to atomically check, create badge, and update XP
    let awarded = false;
    await prisma.$transaction(async (tx) => {
      // Check if user already has this badge
      const existingBadge = await tx.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      if (existingBadge) {
        awarded = false;
        return; // Already awarded, exit transaction early
      }

      // Award the badge
      await tx.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          userGamificationId: userGamification.id,
        },
      });

      // Award XP bonus for the badge atomically with level calculation
      if (badge.xpReward > 0) {
        const previousLevel = userGamification.level;
        const newTotalXP = userGamification.totalXP + badge.xpReward;
        const newLevel = await this.levelService.calculateLevel(newTotalXP);
        const leveledUp = newLevel > previousLevel;

        await tx.userGamification.update({
          where: { userId },
          data: {
            totalXP: newTotalXP,
            ...(leveledUp && { level: newLevel }),
          },
        });
      }

      awarded = true;
    });

    return awarded;
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
   * Uses pre-fetched level configs to avoid N+1 queries.
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
    levelConfigs?: Awaited<ReturnType<typeof prisma.levelConfig.findMany>>,
  ): Promise<GamificationProfile> {
    // Use pre-fetched configs if provided, otherwise fetch individually (legacy fallback)
    let currentLevelConfig;
    let nextLevelConfig;

    if (levelConfigs && levelConfigs.length > 0) {
      currentLevelConfig = levelConfigs.find((lc) => lc.level === entity.level);
      nextLevelConfig = levelConfigs.find((lc) => lc.level === entity.level + 1);
    } else {
      // Fallback: fetch individually (for backward compatibility, e.g., getOrCreate)
      const current = await this.getLevelConfig(entity.level);
      const next = await this.getNextLevelConfig(entity.level);
      currentLevelConfig = current
        ? { level: current.level, title: current.title, minXP: current.minXP, icon: current.icon }
        : undefined;
      nextLevelConfig = next
        ? { level: next.level, title: next.title, minXP: next.minXP, icon: next.icon }
        : undefined;
    }

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
