/**
 * BadgeRuleEvaluator — the single interpreter of `Badge.rules`.
 *
 * Both sides of the badge system read rules through this class:
 * - the write side (`BadgeAwardService`) decides what to award;
 * - the read side (`BadgeProgressCalculator`) decides what to display.
 *
 * A rule is data: `{ type, value }`. Adding a badge is a seed row, not a class.
 * An unknown rule type is reported as `null` (not 0% progress) so a typo in the
 * seed is visible instead of silently showing an unreachable badge.
 *
 * All metrics for one user are loaded in a single parallel batch, so evaluating
 * the whole catalog costs five queries, not five per badge.
 */

import type {
  BadgeDefinition,
  BadgeRequirement,
} from '@/features/gamification/domain/entities/badge.types.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port';

/** Last-attempt partial score (0..1) that counts as high partial credit. */
export const HIGH_PARTIAL_CREDIT_MIN_SCORE = 0.8;

/** Lesson statuses that count towards `LESSON_COUNT`. */
export const COMPLETED_LESSON_STATUSES: readonly string[] = ['MASTERED', 'IN_PROGRESS'];

/** Raw counters a badge rule can reference. */
export interface BadgeMetrics {
  streak: number;
  level: number;
  completedLessons: number;
  perfectFirstAttempts: number;
  hintFreePerfectLessons: number;
  highPartialCreditLessons: number;
}

/** Progress of one rule for one user. */
export interface BadgeRuleProgress {
  /** Current value, capped at the target. */
  current: number;
  target: number;
  satisfied: boolean;
}

function currentFor(type: BadgeRequirement['type'], metrics: BadgeMetrics): number | null {
  switch (type) {
    case 'STREAK':
      return metrics.streak;
    case 'LEVEL':
      return metrics.level;
    case 'LESSON_COUNT':
      return metrics.completedLessons;
    case 'PERFECT_ATTEMPT':
      return metrics.perfectFirstAttempts;
    case 'HINT_FREE_PERFECT_LESSONS':
      return metrics.hintFreePerfectLessons;
    case 'HIGH_PARTIAL_CREDIT_LESSONS':
      return metrics.highPartialCreditLessons;
    default:
      return null;
  }
}

export class BadgeRuleEvaluator {
  constructor(
    private readonly userGamificationRepo: IUserGamificationRepository,
    private readonly progressRepo: ProgressRepository,
    private readonly activityAttemptRepo: ActivityAttemptRepository,
  ) {}

  /**
   * Loads every counter a rule may reference, in one parallel batch.
   */
  async loadMetrics(userId: string): Promise<BadgeMetrics> {
    const [
      stats,
      completedLessons,
      perfectFirstAttempts,
      hintFreePerfectLessons,
      highPartialCreditLessons,
    ] = await Promise.all([
      this.userGamificationRepo.getProfileStats(userId),
      this.progressRepo.countByUserIdAndStatus(userId, [...COMPLETED_LESSON_STATUSES]),
      this.activityAttemptRepo.countCorrectFirstAttempts(userId),
      this.activityAttemptRepo.countHintFreeCorrectFirstAttemptAtoms(userId),
      this.activityAttemptRepo.countAtomsWithHighPartialCredit(
        userId,
        HIGH_PARTIAL_CREDIT_MIN_SCORE,
      ),
    ]);

    return {
      streak: stats?.currentStreak ?? 0,
      level: stats?.level ?? 1,
      completedLessons,
      perfectFirstAttempts,
      hintFreePerfectLessons,
      highPartialCreditLessons,
    };
  }

  /**
   * Evaluates one rule against already-loaded metrics.
   * Returns `null` for an unusable rule (unknown type or a non-positive target).
   */
  evaluate(requirement: BadgeRequirement, metrics: BadgeMetrics): BadgeRuleProgress | null {
    const target = requirement.value;

    if (!Number.isFinite(target) || target <= 0) {
      return null;
    }

    const current = currentFor(requirement.type, metrics);
    if (current === null) {
      return null;
    }

    return {
      current: Math.min(current, target),
      target,
      satisfied: current >= target,
    };
  }

  /**
   * Evaluates a whole catalog for one user with a single metrics load.
   * Badges with an unusable rule are omitted.
   */
  async evaluateAll(
    userId: string,
    badges: readonly BadgeDefinition[],
  ): Promise<Map<string, BadgeRuleProgress>> {
    const metrics = await this.loadMetrics(userId);
    const result = new Map<string, BadgeRuleProgress>();

    for (const badge of badges) {
      const progress = this.evaluate(badge.rules, metrics);
      if (progress) {
        result.set(badge.code, progress);
      }
    }

    return result;
  }
}
