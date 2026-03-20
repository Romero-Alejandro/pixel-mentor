/**
 * Pure utility functions for badge progress calculation.
 * These functions can be tested without database access.
 */

/**
 * Badge requirement types from seed data rules.
 */
export type BadgeRequirementType = 'LESSON_COUNT' | 'STREAK' | 'LEVEL' | 'PERFECT_ATTEMPT';

/**
 * The requirement needed to earn a badge.
 */
export interface BadgeRequirement {
  type: BadgeRequirementType;
  value: number;
}

/**
 * Badge definition from the database.
 */
export interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  rules: BadgeRequirement;
  isActive: boolean;
}

/**
 * Progress toward earning a badge.
 */
export interface BadgeProgress {
  badgeCode: string;
  badgeName: string;
  badgeIcon: string;
  requirementType: BadgeRequirementType;
  current: number;
  target: number;
  percent: number;
  earned: boolean;
  earnedAt?: Date;
}

/**
 * Result of awarding a badge.
 */
export interface BadgeAwardResult {
  awarded: boolean;
  badgeCode: string;
  badgeName: string;
  badgeIcon: string;
  xpAwarded: number;
  error?: string;
}

/**
 * Aggregate badge statistics for a user.
 */
export interface UserBadgeStats {
  totalEarned: number;
  totalXPFromBadges: number;
  byType: Record<BadgeRequirementType, number>;
}

/**
 * Parse badge rules from database JSON format.
 */
export function parseBadgeRules(rules: Record<string, unknown>): BadgeRequirement | null {
  const type = rules['type'] as BadgeRequirementType | undefined;
  const value = rules['value'] as number | undefined;

  if (!type || value === undefined) {
    return null;
  }

  return { type, value };
}

/**
 * Check if a badge requirement type is valid.
 */
export function isValidRequirementType(type: string): type is BadgeRequirementType {
  return ['LESSON_COUNT', 'STREAK', 'LEVEL', 'PERFECT_ATTEMPT'].includes(type);
}

/**
 * Calculate progress summary statistics.
 */
export function calculateProgressSummary(progress: BadgeProgress[]): {
  total: number;
  earned: number;
  inProgress: number;
  overallPercent: number;
} {
  const total = progress.length;
  const earned = progress.filter((p) => p.earned).length;
  const inProgress = progress.filter((p) => !p.earned && p.percent > 0).length;
  const overallPercent = total > 0 ? Math.round((earned / total) * 100) : 0;

  return {
    total,
    earned,
    inProgress,
    overallPercent,
  };
}
