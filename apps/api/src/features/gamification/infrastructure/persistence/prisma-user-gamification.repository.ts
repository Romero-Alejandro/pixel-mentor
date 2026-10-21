/**
 * Prisma-based User Gamification Repository.
 *
 * `UserGamification` holds the cached aggregate (totalXP + streak state);
 * `level` is never stored — it is derived from `totalXP` by LevelService.
 */

import type { LevelService } from '@/features/gamification/application/services/level.service.js';
import type {
  IUserGamificationRepository,
  GamificationProfile,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import { prisma } from '@/database/client.js';
import { isUniqueConstraintError } from '@/database/prisma-error.js';
import { normalizeCurrentStreak } from '@/features/gamification/application/services/streak-calculator.service.js';

const BADGES_INCLUDE = {
  badges: {
    include: {
      badge: true,
    },
  },
} as const;

interface UserGamificationRow {
  userId: string;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: Date | null;
  badges: Array<{
    earnedAt: Date;
    badge: {
      code: string;
      name: string;
      icon: string;
      description: string;
    };
  }>;
}

export class PrismaUserGamificationRepository implements IUserGamificationRepository {
  constructor(private readonly levelService: LevelService) {}

  async findByUserId(userId: string): Promise<GamificationProfile | null> {
    const row = await prisma.userGamification.findUnique({
      where: { userId },
      include: BADGES_INCLUDE,
    });

    if (!row) {
      return null;
    }

    return this.mapToProfile(row);
  }

  async getOrCreate(userId: string): Promise<GamificationProfile> {
    try {
      const row = await prisma.userGamification.upsert({
        where: { userId },
        create: { userId },
        update: {},
        include: BADGES_INCLUDE,
      });

      return this.mapToProfile(row);
    } catch (error) {
      // Two concurrent first touches of the same user can both attempt the
      // INSERT (Prisma emulates an upsert with an empty update). The loser gets
      // P2002, and the row it wanted now exists — which is the postcondition.
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await prisma.userGamification.findUnique({
        where: { userId },
        include: BADGES_INCLUDE,
      });

      if (!existing) {
        throw error;
      }

      return this.mapToProfile(existing);
    }
  }

  async updateStreak(
    userId: string,
    data: { currentStreak: number; longestStreak: number; lastActivityAt: Date },
  ): Promise<void> {
    const longestStreak = Math.max(data.currentStreak, data.longestStreak);

    await prisma.userGamification.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: data.currentStreak,
        longestStreak,
        lastActivityAt: data.lastActivityAt,
      },
      update: {
        currentStreak: data.currentStreak,
        longestStreak,
        lastActivityAt: data.lastActivityAt,
      },
    });
  }

  async getProfileStats(userId: string): Promise<{
    currentStreak: number;
    level: number;
    totalXP: number;
    totalBadges: number;
  } | null> {
    const row = await prisma.userGamification.findUnique({
      where: { userId },
      include: { badges: { select: { id: true } } },
    });

    if (!row) {
      return null;
    }

    return {
      currentStreak: normalizeCurrentStreak(row.currentStreak, row.lastActivityAt),
      level: await this.levelService.calculateLevel(row.totalXP),
      totalXP: row.totalXP,
      totalBadges: row.badges.length,
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

  private async mapToProfile(row: UserGamificationRow): Promise<GamificationProfile> {
    const level = await this.levelService.describe(row.totalXP);

    return {
      userId: row.userId,
      level: level.level,
      levelTitle: level.title,
      currentXP: row.totalXP,
      xpToNextLevel: level.xpToNextLevel,
      xpProgressPercent: level.progressPercent,
      streak: normalizeCurrentStreak(row.currentStreak, row.lastActivityAt),
      longestStreak: row.longestStreak,
      lastActivityAt: row.lastActivityAt,
      totalBadges: row.badges.length,
      badges: row.badges.map((userBadge) => ({
        code: userBadge.badge.code,
        name: userBadge.badge.name,
        icon: userBadge.badge.icon,
        description: userBadge.badge.description,
        earnedAt: userBadge.earnedAt,
      })),
    };
  }
}
