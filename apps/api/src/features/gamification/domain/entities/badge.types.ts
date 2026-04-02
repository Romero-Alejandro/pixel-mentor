/**
 * Badge Types - Type definitions for the badge system.
 *
 * These types define:
 * - BadgeProgress: Shows progress toward earning a badge (e.g., 5/7 days)
 * - BadgeDefinition: Full badge information from the database
 * - BadgeRequirement: The requirement needed to earn a badge
 */

/**
 * Supported badge requirement types from seed data rules.
 */
export type BadgeRequirementType =
  | 'LESSON_COUNT' // Badge earned after completing N lessons
  | 'STREAK' // Badge earned after maintaining N-day streak
  | 'LEVEL' // Badge earned after reaching a level
  | 'PERFECT_ATTEMPT'; // Badge earned on first perfect attempt

/**
 * The requirement needed to earn a badge.
 */
export interface BadgeRequirement {
  /** Type of requirement */
  type: BadgeRequirementType;
  /** Target value needed (e.g., 7 for 7-day streak) */
  value: number;
}

/**
 * Badge definition from the database.
 */
export interface BadgeDefinition {
  /** Unique badge code (e.g., 'FIRST_LESSON', 'STREAK_7') */
  code: string;
  /** Display name in Spanish */
  name: string;
  /** Description of how the badge is earned */
  description: string;
  /** Emoji icon for display */
  icon: string;
  /** XP reward for earning the badge */
  xpReward: number;
  /** Parsed rules/requirement for earning the badge */
  rules: BadgeRequirement;
  /** Whether the badge is currently active */
  isActive: boolean;
}

/**
 * Progress toward earning a badge.
 * Shows the current status for unearned badges.
 */
export interface BadgeProgress {
  /** Badge code */
  badgeCode: string;
  /** Badge display name */
  badgeName: string;
  /** Badge icon */
  badgeIcon: string;
  /** Requirement type */
  requirementType: BadgeRequirementType;
  /** Current progress value (e.g., 5 days) */
  current: number;
  /** Target value needed (e.g., 7 days) */
  target: number;
  /** Progress as a percentage (0-100) */
  percent: number;
  /** Whether the badge has been earned */
  earned: boolean;
  /** Date earned (if earned) */
  earnedAt?: Date;
}

/**
 * Result of awarding a badge.
 */
export interface BadgeAwardResult {
  /** Whether the badge was newly awarded */
  awarded: boolean;
  /** Badge code */
  badgeCode: string;
  /** Badge name */
  badgeName: string;
  /** Badge icon */
  badgeIcon: string;
  /** XP awarded for the badge */
  xpAwarded: number;
  /** Error message if award failed */
  error?: string;
}

/**
 * Aggregate badge statistics for a user.
 */
export interface UserBadgeStats {
  /** Total badges earned */
  totalEarned: number;
  /** Total XP earned from badges */
  totalXPFromBadges: number;
  /** Badges by requirement type */
  byType: Record<BadgeRequirementType, number>;
}
