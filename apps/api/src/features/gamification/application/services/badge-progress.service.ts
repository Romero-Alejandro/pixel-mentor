/**
 * Badge progress (read side).
 *
 * Delegates all rule interpretation to BadgeRuleEvaluator, so the progress a
 * student sees is computed by exactly the same code that decides awards.
 * One metrics load serves the whole catalog.
 */

import type {
  BadgeDefinition,
  BadgeProgress,
} from '@/features/gamification/domain/entities/badge.types.js';
import type { IBadgeRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import type {
  BadgeRuleEvaluator,
  BadgeRuleProgress,
} from '@/features/gamification/application/services/badge-rule.evaluator.js';

interface OwnedBadge {
  code: string;
  earnedAt: Date;
}

export class BadgeProgressCalculator {
  constructor(
    private badgeRepo: IBadgeRepository,
    private ruleEvaluator: BadgeRuleEvaluator,
  ) {}

  async calculateBadgeProgress(userId: string, badgeCode: string): Promise<BadgeProgress | null> {
    const badge = await this.badgeRepo.findByCode(badgeCode);

    if (!badge || !badge.isActive) {
      return null;
    }

    const [metrics, owned] = await Promise.all([
      this.ruleEvaluator.loadMetrics(userId),
      this.badgeRepo.getUserBadges(userId),
    ]);

    return this.toProgress(badge, this.ruleEvaluator.evaluate(badge.rules, metrics), owned);
  }

  async getAllBadgeProgress(userId: string): Promise<BadgeProgress[]> {
    const [badges, owned] = await Promise.all([
      this.badgeRepo.getActiveBadges(),
      this.badgeRepo.getUserBadges(userId),
    ]);

    if (badges.length === 0) {
      return [];
    }

    const metrics = await this.ruleEvaluator.loadMetrics(userId);

    return badges
      .map((badge) =>
        this.toProgress(badge, this.ruleEvaluator.evaluate(badge.rules, metrics), owned),
      )
      .filter((progress): progress is BadgeProgress => progress !== null);
  }

  async getNearCompletionBadges(userId: string, minPercent = 50): Promise<BadgeProgress[]> {
    const allProgress = await this.getAllBadgeProgress(userId);
    return allProgress.filter((progress) => !progress.earned && progress.percent >= minPercent);
  }

  /**
   * Builds the display model. A badge with an unusable rule is omitted instead
   * of being shown as permanently unreachable.
   */
  private toProgress(
    badge: BadgeDefinition,
    rule: BadgeRuleProgress | null,
    owned: readonly OwnedBadge[],
  ): BadgeProgress | null {
    if (!rule) {
      return null;
    }

    const ownedBadge = owned.find((entry) => entry.code === badge.code);
    const percent = Math.min(100, Math.round((rule.current / rule.target) * 100));

    return {
      badgeCode: badge.code,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      requirementType: badge.rules.type,
      current: rule.current,
      target: rule.target,
      percent: ownedBadge ? 100 : percent,
      earned: ownedBadge !== undefined,
      earnedAt: ownedBadge?.earnedAt,
    };
  }
}
