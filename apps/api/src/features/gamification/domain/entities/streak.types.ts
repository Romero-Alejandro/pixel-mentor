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
