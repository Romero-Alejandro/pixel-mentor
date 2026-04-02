/**
 * Prisma-based User Gamification Repository.
 *
 * Implements IUserGamificationRepository using Prisma ORM.
 */

import { prisma } from '@/database/client.js';
import { LevelService } from '../../application/services/level.service';
import type {
  IUserGamificationRepository,
  GamificationProfile,
} from '../../domain/ports/gamification.ports';

export class PrismaUserGamificationRepository implements IUserGamificationRepository {
  private levelService: LevelService;

  constructor() {
    this.levelService = new LevelService();
  }

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

    const levelsNeeded = [userGamification.level, userGamification.level + 1];
    const levelConfigs = await prisma.levelConfig.findMany({
      where: { level: { in: levelsNeeded } },
    });

    return this.mapToProfile(userGamification, levelConfigs);
  }

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

  async addXP(
    userId: string,
    amount: number,
  ): Promise<{ newXP: number; leveledUp: boolean; newLevel?: number; newLevelTitle?: string }> {
    await this.getOrCreate(userId);

    const before = await prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!before) {
      throw new Error(`Failed to get or create gamification for user ${userId}`);
    }

    const previousLevel = before.level;
    const newTotalXP = before.totalXP + amount;

    const newLevel = await this.levelService.calculateLevel(newTotalXP);
    const leveledUp = newLevel > previousLevel;
    const newLevelTitle = leveledUp ? this.levelService.getLevelTitle(newLevel) : undefined;

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

  async updateStreak(
    userId: string,
    data: { currentStreak: number; longestStreak: number; lastActivityAt: Date },
  ): Promise<void> {
    await prisma.userGamification.update({
      where: { userId },
      data: {
        currentStreak: data.currentStreak,
        longestStreak: Math.max(data.currentStreak, data.longestStreak),
        lastActivityAt: data.lastActivityAt,
      },
    });
  }

  async breakStreak(userId: string): Promise<void> {
    await prisma.userGamification.update({
      where: { userId },
      data: {
        currentStreak: 0,
        lastActivityAt: null,
      },
    });
  }

  async getProfileStats(
    userId: string,
  ): Promise<{
    currentStreak: number;
    level: number;
    totalXP: number;
    totalBadges: number;
  } | null> {
    const profile = await prisma.userGamification.findUnique({
      where: { userId },
      include: { badges: true },
    });

    if (!profile) {
      return null;
    }

    return {
      currentStreak: profile.currentStreak,
      level: profile.level,
      totalXP: profile.totalXP,
      totalBadges: profile.badges.length,
    };
  }

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

  async getNextLevelConfig(
    currentLevel: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null> {
    return this.getLevelConfig(currentLevel + 1);
  }

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
    let currentLevelConfig;
    let nextLevelConfig;

    if (levelConfigs && levelConfigs.length > 0) {
      currentLevelConfig = levelConfigs.find((lc) => lc.level === entity.level);
      nextLevelConfig = levelConfigs.find((lc) => lc.level === entity.level + 1);
    } else {
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
