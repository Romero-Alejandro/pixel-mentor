/**
 * Streak Calculator Utility.
 *
 * Provides pure functions for calculating streaks from activity dates.
 * All calculations use UTC to ensure consistent behavior across timezones.
 */

import type { StreakInfo } from '../../domain/entities/streak.types';

/**
 * Get the start of the day in UTC for a given date.
 * This normalizes the date to midnight UTC.
 */
export function getStartOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if two dates are the same calendar day (ignoring time).
 * Uses UTC for timezone consistency.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = getStartOfDayUTC(date1);
  const d2 = getStartOfDayUTC(date2);
  return d1.getTime() === d2.getTime();
}

/**
 * Check if two dates are consecutive calendar days.
 * Returns true if date2 is exactly one day after date1.
 * Uses UTC for timezone consistency.
 */
export function isConsecutiveDay(date1: Date, date2: Date): boolean {
  const d1 = getStartOfDayUTC(date1);
  const d2 = getStartOfDayUTC(date2);

  // Calculate difference in milliseconds
  const diffMs = d2.getTime() - d1.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  return diffMs === msPerDay;
}

/**
 * Get the number of days since a given date.
 * Returns 0 if the date is today or in the future.
 * Uses UTC for timezone consistency.
 */
export function getDaysSince(date: Date, fromDate: Date = new Date()): number {
  const from = getStartOfDayUTC(fromDate);
  const d = getStartOfDayUTC(date);

  const diffMs = from.getTime() - d.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const days = Math.floor(diffMs / msPerDay);
  return Math.max(0, days);
}

/**
 * Check if more than 24 hours have passed since the last activity.
 * Streak breaks if the user missed a day (more than 24 hours).
 * Uses UTC for timezone consistency.
 */
export function isStreakBroken(lastActivityDate: Date, currentDate: Date = new Date()): boolean {
  const lastActivity = new Date(lastActivityDate);
  const current = new Date(currentDate);

  const diffMs = current.getTime() - lastActivity.getTime();
  const msPerHour = 60 * 60 * 1000;
  const MS_BREAK_THRESHOLD = 24 * msPerHour; // 24 hours

  // Streak is broken if more than 24 hours have passed
  return diffMs > MS_BREAK_THRESHOLD;
}

/**
 * Calculate streak information from a sorted array of activity dates.
 *
 * Activities should be sorted in ascending order (oldest first).
 * Duplicate dates on the same day are treated as a single activity.
 *
 * @param activities - Sorted array of activity dates
 * @param previousLongestStreak - The user's previous longest streak (for record detection)
 * @param referenceDate - Optional reference date (defaults to now). Used for testing.
 * @returns StreakInfo with current and longest streak calculations
 */
export function calculateStreakFromActivities(
  activities: Date[],
  previousLongestStreak: number = 0,
  referenceDate: Date = new Date(),
): StreakInfo {
  // Handle empty activities
  if (!activities || activities.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: previousLongestStreak,
      isNewRecord: false,
    };
  }

  // Normalize to start of day and remove duplicates
  const uniqueDays = getUniqueDays(activities);

  if (uniqueDays.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: previousLongestStreak,
      isNewRecord: false,
    };
  }

  // Sort by date ascending
  const sortedDays = [...uniqueDays].sort((a, b) => a.getTime() - b.getTime());

  // Calculate consecutive streaks - find the longest streak in the activities
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    if (isConsecutiveDay(sortedDays[i - 1], sortedDays[i])) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 1;
    }
  }

  // Determine current streak - count consecutive days from the end
  const lastActivityDay = sortedDays[sortedDays.length - 1];
  const today = getStartOfDayUTC(referenceDate);
  const daysSinceLastActivity = Math.floor(
    (today.getTime() - lastActivityDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  let currentStreak = 0;
  if (daysSinceLastActivity <= 1) {
    // Last activity was today or yesterday - count backwards from the end
    currentStreak = 1;
    for (let i = sortedDays.length - 2; i >= 0; i--) {
      if (isConsecutiveDay(sortedDays[i], sortedDays[i + 1])) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Determine if this is a new record
  const maxLongest = Math.max(longestStreak, previousLongestStreak);
  const isNewRecord = longestStreak > previousLongestStreak && longestStreak > 0;

  return {
    currentStreak,
    longestStreak: maxLongest,
    isNewRecord,
    currentStreakStart:
      currentStreak > 0 ? sortedDays[sortedDays.length - currentStreak] : undefined,
    longestStreakStart:
      longestStreak > 0 ? sortedDays[sortedDays.length - longestStreak] : undefined,
  };
}

/**
 * Get unique days from an array of dates.
 * Removes duplicates on the same calendar day.
 */
export function getUniqueDays(dates: Date[]): Date[] {
  const seen = new Set<string>();
  const unique: Date[] = [];

  for (const date of dates) {
    const dayKey = getStartOfDayUTC(date).toISOString();
    if (!seen.has(dayKey)) {
      seen.add(dayKey);
      unique.push(getStartOfDayUTC(date));
    }
  }

  return unique;
}

/**
 * Calculate bonus XP based on streak length.
 * Returns 0 if streak is below bonus threshold.
 */
export function calculateStreakBonus(currentStreak: number): number {
  if (currentStreak >= 30) {
    return 25; // STREAK_30_BONUS_XP
  }
  if (currentStreak >= 5) {
    return 10; // STREAK_5_BONUS_XP
  }
  return 0;
}

/**
 * Format a streak for display purposes.
 */
export function formatStreak(streak: number): string {
  if (streak === 0) {
    return 'Sin racha';
  }
  if (streak === 1) {
    return '1 día';
  }
  return `${streak} días`;
}
