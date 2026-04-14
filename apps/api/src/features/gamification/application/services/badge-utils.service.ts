/**
 * Pure utility functions for badge progress calculation.
 */

import type { BadgeRequirementType, BadgeProgress } from '../../domain/entities/badge.types';

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
