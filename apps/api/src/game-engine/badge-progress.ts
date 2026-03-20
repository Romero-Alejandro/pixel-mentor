/**
 * Badge Progress Calculator - Calculates progress toward earning badges.
 *
 * This service calculates how close a user is to earning each badge:
 * - Streak badges: Current streak vs required streak
 * - Level badges: Current level vs required level
 * - Lesson count badges: Lessons completed vs required count
 * - Perfect attempt badges: Perfect attempts count vs required
 */

// Re-export types and pure functions from badge-utils
export type {
  BadgeRequirement,
  BadgeRequirementType,
  BadgeProgress,
  BadgeAwardResult,
  UserBadgeStats,
} from './badge-utils';

export { parseBadgeRules, isValidRequirementType, calculateProgressSummary } from './badge-utils';

import type { BadgeProgress, BadgeRequirementType } from './badge-utils';

import { prisma } from '@/infrastructure/adapters/database/client.js';

/**
 * Calculate progress toward a specific badge.
 *
 * @param userId - The user ID to calculate progress for
 * @param badgeCode - The badge code to calculate progress toward
 * @returns BadgeProgress or null if badge not found
 */
export async function calculateBadgeProgress(
  userId: string,
  badgeCode: string,
): Promise<BadgeProgress | null> {
  // Get badge definition
  const badge = await prisma.badge.findUnique({
    where: { code: badgeCode },
  });

  if (!badge || !badge.isActive) {
    return null;
  }

  // Parse rules
  const rules = badge.rules as Record<string, unknown> | null;
  if (!rules || typeof rules !== 'object') {
    return null;
  }

  const type = rules['type'] as string | undefined;
  const value = rules['value'] as number | undefined;

  if (!type || value === undefined) {
    return null;
  }

  // Get user's current stats
  const userGamification = await prisma.userGamification.findUnique({
    where: { userId },
  });

  // Get completed lessons count
  const completedLessons = await prisma.userProgress.count({
    where: {
      userId,
      status: { in: ['MASTERED', 'IN_PROGRESS'] },
    },
  });

  // Get perfect attempts count (first attempt correct)
  const perfectAttempts = await prisma.activityAttempt.count({
    where: {
      userId,
      correct: true,
      attemptNo: 1,
    },
  });

  // Calculate progress based on badge type
  let current = 0;
  const target = value;

  switch (type) {
    case 'STREAK':
      current = userGamification?.currentStreak ?? 0;
      break;

    case 'LEVEL':
      current = userGamification?.level ?? 1;
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

  // Check if already earned
  const userBadge = await prisma.userBadge.findUnique({
    where: {
      userId_badgeId: {
        userId,
        badgeId: badge.id,
      },
    },
  });

  const earned = userBadge !== null;
  const percent = Math.min(100, Math.round((current / target) * 100));

  return {
    badgeCode: badge.code,
    badgeName: badge.name,
    badgeIcon: badge.icon,
    requirementType: type as BadgeRequirementType,
    current: Math.min(current, target), // Cap at target
    target,
    percent: earned ? 100 : percent,
    earned,
    earnedAt: userBadge?.earnedAt,
  };
}

/**
 * Get progress for all badges for a user.
 *
 * @param userId - The user ID to get progress for
 * @returns Array of BadgeProgress for all active badges
 */
export async function getAllBadgeProgress(userId: string): Promise<BadgeProgress[]> {
  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  const progressPromises = badges.map(async (badge) => {
    return calculateBadgeProgress(userId, badge.code);
  });

  const results = await Promise.all(progressPromises);
  return results.filter((p): p is BadgeProgress => p !== null);
}

/**
 * Get badges that are close to being earned (>= 50% progress).
 *
 * @param userId - The user ID to check
 * @param minPercent - Minimum percentage to include (default: 50)
 * @returns Array of BadgeProgress that are close to completion
 */
export async function getNearCompletionBadges(
  userId: string,
  minPercent = 50,
): Promise<BadgeProgress[]> {
  const allProgress = await getAllBadgeProgress(userId);
  return allProgress.filter((p) => !p.earned && p.percent >= minPercent);
}
