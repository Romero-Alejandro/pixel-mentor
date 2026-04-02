import type { BadgeProgress, BadgeRequirementType } from '../../domain/entities/badge.types';
import type {
  IBadgeRepository,
  IUserGamificationRepository,
} from '../../domain/ports/gamification.ports';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port';

export function parseBadgeRules(
  rules: Record<string, unknown>,
): { type: BadgeRequirementType; value: number } | null {
  const type = rules['type'] as BadgeRequirementType | undefined;
  const value = rules['value'] as number | undefined;

  if (!type || value === undefined) {
    return null;
  }

  return { type, value };
}

export class BadgeProgressCalculator {
  constructor(
    private badgeRepo: IBadgeRepository,
    private userGamificationRepo: IUserGamificationRepository,
    private progressRepo: ProgressRepository,
    private activityAttemptRepo: ActivityAttemptRepository,
  ) {}

  async calculateBadgeProgress(userId: string, badgeCode: string): Promise<BadgeProgress | null> {
    const badge = await this.badgeRepo.findByCode(badgeCode);

    if (!badge || !badge.isActive) {
      return null;
    }

    const parsedRules = parseBadgeRules(badge.rules as unknown as Record<string, unknown>);
    if (!parsedRules) {
      return null;
    }

    const { type, value } = parsedRules;

    const profileStats = await this.userGamificationRepo.getProfileStats(userId);
    const completedLessons = await this.progressRepo.countByUserIdAndStatus(userId, [
      'MASTERED',
      'IN_PROGRESS',
    ]);
    const perfectAttempts = await this.activityAttemptRepo.countCorrectFirstAttempts(userId);

    let current = 0;
    const target = value;

    switch (type) {
      case 'STREAK':
        current = profileStats?.currentStreak ?? 0;
        break;
      case 'LEVEL':
        current = profileStats?.level ?? 1;
        break;
      case 'LESSON_COUNT':
        current = completedLessons;
        break;
      case 'PERFECT_ATTEMPT':
        current = perfectAttempts;
        break;
      default:
        return null;
    }

    const earned = await this.badgeRepo.hasBadge(userId, badgeCode);
    const percent = Math.min(100, Math.round((current / target) * 100));

    const userBadges = await this.badgeRepo.getUserBadges(userId);
    const userBadge = userBadges.find((b) => b.code === badgeCode);

    return {
      badgeCode: badge.code,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      requirementType: type,
      current: Math.min(current, target),
      target,
      percent: earned ? 100 : percent,
      earned,
      earnedAt: userBadge?.earnedAt,
    };
  }

  async getAllBadgeProgress(userId: string): Promise<BadgeProgress[]> {
    const badges = await this.badgeRepo.getActiveBadges();

    const progressPromises = badges.map(async (badge) => {
      return this.calculateBadgeProgress(userId, badge.code);
    });

    const results = await Promise.all(progressPromises);
    return results.filter((p): p is BadgeProgress => p !== null);
  }

  async getNearCompletionBadges(userId: string, minPercent = 50): Promise<BadgeProgress[]> {
    const allProgress = await this.getAllBadgeProgress(userId);
    return allProgress.filter((p) => !p.earned && p.percent >= minPercent);
  }
}
