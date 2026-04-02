/**
 * Streak-related types for the gamification engine.
 */

/**
 * Result of recording a daily activity.
 */
export interface StreakResult {
  /** The user's current streak count */
  currentStreak: number;
  /** The user's longest streak ever achieved */
  longestStreak: number;
  /** Whether this activity set a new longest streak record */
  isNewRecord: boolean;
  /** Bonus XP earned from streak (e.g., milestone bonuses) */
  bonusXP: number;
  /** Whether the streak was broken before this activity */
  streakWasBroken: boolean;
  /** The date of this activity in UTC */
  activityDate: Date;
}

/**
 * Daily activity record for streak tracking.
 */
export interface DailyActivity {
  /** User ID */
  userId: string;
  /** The date of the activity in UTC (start of day) */
  date: Date;
  /** The exact timestamp of the activity */
  timestamp: Date;
}

/**
 * Streak information calculated from activity dates.
 */
export interface StreakInfo {
  /** The current streak count based on activities */
  currentStreak: number;
  /** The longest streak found in the activities */
  longestStreak: number;
  /** Whether this is a new record */
  isNewRecord: boolean;
  /** The starting date of the current streak */
  currentStreakStart?: Date;
  /** The starting date of the longest streak */
  longestStreakStart?: Date;
}

/**
 * Configuration for streak behavior.
 */
export const STREAK_CONFIG = {
  /** Maximum hours without activity before streak breaks (24h + grace period) */
  MAX_INACTIVE_HOURS: 25,
  /** Minimum days in a streak to qualify for bonuses */
  BONUS_THRESHOLD: 5,
  /** Bonus XP for hitting 5+ day streak */
  BONUS_XP_5_DAYS: 10,
  /** Bonus XP for hitting 30+ day streak */
  BONUS_XP_30_DAYS: 25,
  /** Higher streak threshold for larger bonus */
  HIGH_STREAK_THRESHOLD: 30,
} as const;
