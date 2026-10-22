import type {
  IBadgeRepository,
  BadgeDefinition,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import type { BadgeRequirement } from '@/features/gamification/domain/entities/badge.types.js';
import { prisma } from '@/database/client.js';

function parseRules(raw: unknown): BadgeRequirement {
  const r = raw as Record<string, unknown> | null;
  return {
    type: (r?.['type'] as BadgeRequirement['type']) ?? 'LESSON_COUNT',
    value: (r?.['value'] as number) ?? 0,
  };
}

export class PrismaBadgeRepository implements IBadgeRepository {
  async findAll(): Promise<BadgeDefinition[]> {
    const badges = await prisma.badge.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return badges.map((badge) => ({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      xpReward: badge.xpReward,
      rules: parseRules(badge.rules),
      isActive: badge.isActive,
    }));
  }

  async findByCode(code: string): Promise<BadgeDefinition | null> {
    const badge = await prisma.badge.findUnique({
      where: { code },
    });

    if (!badge) {
      return null;
    }

    return {
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      xpReward: badge.xpReward,
      rules: parseRules(badge.rules),
      isActive: badge.isActive,
    };
  }

  async getActiveBadges(): Promise<BadgeDefinition[]> {
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
      rules: parseRules(badge.rules),
      isActive: badge.isActive,
    }));
  }

  async getUserBadges(
    userId: string,
  ): Promise<
    Array<{ code: string; name: string; icon: string; description: string; earnedAt: Date }>
  > {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });

    return userBadges.map((ub) => ({
      code: ub.badge.code,
      name: ub.badge.name,
      icon: ub.badge.icon,
      description: ub.badge.description,
      earnedAt: ub.earnedAt,
    }));
  }

  async getUserBadgeCount(userId: string): Promise<number> {
    return prisma.userBadge.count({ where: { userId } });
  }

  async getUserBadgeStats(
    userId: string,
  ): Promise<{ totalEarned: number; totalXPFromBadges: number; byType: Record<string, number> }> {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
    });

    const byType: Record<string, number> = {
      LESSON_COUNT: 0,
      STREAK: 0,
      LEVEL: 0,
      PERFECT_ATTEMPT: 0,
    };

    let totalXPFromBadges = 0;

    for (const ub of userBadges) {
      const rules = ub.badge.rules as Record<string, unknown> | null;
      if (rules && typeof rules.type === 'string') {
        byType[rules.type] = (byType[rules.type] ?? 0) + 1;
      }
      totalXPFromBadges += ub.badge.xpReward;
    }

    return { totalEarned: userBadges.length, totalXPFromBadges, byType };
  }

  async hasBadge(userId: string, badgeCode: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({ where: { code: badgeCode } });

    if (!badge) {
      return false;
    }

    const userBadge = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    return userBadge !== null;
  }
}
