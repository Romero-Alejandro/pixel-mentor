/**
 * Unit tests for Streak Calculator Utility.
 */

import {
  getStartOfDayUTC,
  isSameDay,
  isConsecutiveDay,
  getDaysSince,
  isStreakBroken,
  calculateStreakFromActivities,
  getUniqueDays,
  calculateStreakBonus,
  formatStreak,
} from '../streak-calculator';

describe('StreakCalculator', () => {
  // Use fixed dates for consistent testing relative to a "reference" date
  const REFERENCE_DATE = new Date('2024-03-15T12:00:00Z');

  // Helper to get dates relative to reference
  const daysAgo = (days: number): Date => {
    const d = new Date(REFERENCE_DATE);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  };

  describe('getStartOfDayUTC', () => {
    it('should normalize a date to midnight UTC', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = getStartOfDayUTC(date);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
      expect(result.getUTCDate()).toBe(15);
    });

    it('should handle dates at midnight UTC', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = getStartOfDayUTC(date);

      expect(result.getUTCDate()).toBe(15);
    });

    it('should return a new Date object, not mutate the original', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = getStartOfDayUTC(date);

      expect(date.getUTCHours()).toBe(14);
      expect(result.getUTCHours()).toBe(0);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same calendar day', () => {
      const date1 = new Date('2024-01-15T08:00:00Z');
      const date2 = new Date('2024-01-15T20:00:00Z');

      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different calendar days', () => {
      const date1 = new Date('2024-01-15T23:59:59Z');
      const date2 = new Date('2024-01-16T00:00:01Z');

      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should handle same day across different timezones correctly', () => {
      const date1 = new Date('2024-01-15T03:00:00Z');
      const date2 = new Date('2024-01-15T02:00:00Z');

      expect(isSameDay(date1, date2)).toBe(true);
    });
  });

  describe('isConsecutiveDay', () => {
    it('should return true for consecutive calendar days', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-16T00:00:00Z');

      expect(isConsecutiveDay(date1, date2)).toBe(true);
    });

    it('should return false for same day', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-15T00:00:00Z');

      expect(isConsecutiveDay(date1, date2)).toBe(false);
    });

    it('should return false for 2-day gap', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-17T00:00:00Z');

      expect(isConsecutiveDay(date1, date2)).toBe(false);
    });

    it('should return false when date2 is before date1', () => {
      const date1 = new Date('2024-01-16T00:00:00Z');
      const date2 = new Date('2024-01-15T00:00:00Z');

      expect(isConsecutiveDay(date1, date2)).toBe(false);
    });

    it('should handle time component correctly', () => {
      const date1 = new Date('2024-01-15T14:30:00Z');
      const date2 = new Date('2024-01-16T08:15:00Z');

      expect(isConsecutiveDay(date1, date2)).toBe(true);
    });
  });

  describe('getDaysSince', () => {
    it('should return 0 for today', () => {
      const today = REFERENCE_DATE;
      const fromDate = new Date('2024-03-15T20:00:00Z');

      expect(getDaysSince(today, fromDate)).toBe(0);
    });

    it('should return 1 for yesterday', () => {
      const yesterday = daysAgo(1);
      const today = REFERENCE_DATE;

      expect(getDaysSince(yesterday, today)).toBe(1);
    });

    it('should return correct days for past dates', () => {
      const past = daysAgo(5);
      const today = REFERENCE_DATE;

      expect(getDaysSince(past, today)).toBe(5);
    });

    it('should return 0 when date is in the future', () => {
      const future = new Date('2024-03-20T12:00:00Z');
      const today = REFERENCE_DATE;

      expect(getDaysSince(future, today)).toBe(0);
    });
  });

  describe('isStreakBroken', () => {
    it('should return false when last activity was less than 24 hours ago', () => {
      const lastActivity = new Date('2024-01-15T12:00:00Z');
      const current = new Date('2024-01-16T10:00:00Z'); // 22 hours later

      expect(isStreakBroken(lastActivity, current)).toBe(false);
    });

    it('should return false when last activity was exactly 24 hours ago', () => {
      const lastActivity = new Date('2024-01-15T12:00:00Z');
      const current = new Date('2024-01-16T12:00:00Z'); // exactly 24 hours

      expect(isStreakBroken(lastActivity, current)).toBe(false);
    });

    it('should return true when last activity was more than 24 hours ago', () => {
      const lastActivity = new Date('2024-01-15T12:00:00Z');
      const current = new Date('2024-01-16T12:00:01Z'); // 24 hours and 1 second

      expect(isStreakBroken(lastActivity, current)).toBe(true);
    });

    it('should handle same day activities', () => {
      const lastActivity = new Date('2024-01-15T10:00:00Z');
      const current = new Date('2024-01-15T14:00:00Z');

      expect(isStreakBroken(lastActivity, current)).toBe(false);
    });
  });

  describe('calculateStreakFromActivities', () => {
    it('should return 0 streak for empty activities', () => {
      const result = calculateStreakFromActivities([], 0, REFERENCE_DATE);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.isNewRecord).toBe(false);
    });

    it('should handle single activity today', () => {
      const activities = [daysAgo(0)]; // Today
      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it('should handle single activity yesterday', () => {
      const activities = [daysAgo(1)]; // Yesterday
      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it('should calculate consecutive days correctly', () => {
      const activities = [
        daysAgo(4), // 4 days ago
        daysAgo(3),
        daysAgo(2),
        daysAgo(1), // Yesterday
        daysAgo(0), // Today
      ];

      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      expect(result.currentStreak).toBe(5);
      expect(result.longestStreak).toBe(5);
    });

    it('should handle gap in activities', () => {
      // Activities with a gap: 5,4,3 (streak broken), then 1,0 (new streak)
      // To create a gap, we need to skip day 2
      const activities = [
        daysAgo(5), // 5 days ago
        daysAgo(4), // 4 days ago
        daysAgo(3), // 3 days ago
        daysAgo(1), // Yesterday - gap here (day 2 skipped)
        daysAgo(0), // Today
      ];

      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      // Longest streak was 3 days (daysAgo 5, 4, 3)
      // Current streak is 2 days (daysAgo 1, 0)
      expect(result.longestStreak).toBe(3);
      expect(result.currentStreak).toBe(2);
    });

    it('should remove duplicate days', () => {
      const activities = [
        daysAgo(1),
        daysAgo(1), // Duplicate
        daysAgo(1), // Duplicate
        daysAgo(0),
      ];

      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(2);
    });

    it('should detect new record when beating previous longest', () => {
      const activities = [daysAgo(2), daysAgo(1), daysAgo(0)];

      const result = calculateStreakFromActivities(activities, 2, REFERENCE_DATE);

      expect(result.isNewRecord).toBe(true);
      expect(result.longestStreak).toBe(3);
    });

    it('should not mark as new record when not beating previous longest', () => {
      const activities = [daysAgo(1), daysAgo(0)];

      const result = calculateStreakFromActivities(activities, 5, REFERENCE_DATE);

      expect(result.isNewRecord).toBe(false);
      expect(result.longestStreak).toBe(5);
    });

    it('should handle unsorted activities', () => {
      const activities = [
        daysAgo(0), // Today (out of order in input)
        daysAgo(4),
        daysAgo(2),
        daysAgo(3),
        daysAgo(1), // Yesterday
      ];

      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      expect(result.currentStreak).toBe(5);
      expect(result.longestStreak).toBe(5);
    });

    it('should return current streak for consecutive recent activities', () => {
      // Activities from 3, 2, 1 days ago are consecutive
      // Last activity was yesterday, so daysSinceLastActivity = 1
      // The streak should be considered active
      const activities = [daysAgo(3), daysAgo(2), daysAgo(1)];

      const result = calculateStreakFromActivities(activities, 0, REFERENCE_DATE);

      // These are consecutive days, and last activity was yesterday
      expect(result.longestStreak).toBe(3);
      expect(result.currentStreak).toBe(3);
    });
  });

  describe('getUniqueDays', () => {
    it('should remove duplicate dates on same day', () => {
      const dates = [
        new Date('2024-01-15T08:00:00Z'),
        new Date('2024-01-15T14:00:00Z'),
        new Date('2024-01-15T22:00:00Z'),
      ];

      const result = getUniqueDays(dates);

      expect(result.length).toBe(1);
    });

    it('should preserve different days', () => {
      const dates = [
        new Date('2024-01-15T08:00:00Z'),
        new Date('2024-01-16T14:00:00Z'),
        new Date('2024-01-17T22:00:00Z'),
      ];

      const result = getUniqueDays(dates);

      expect(result.length).toBe(3);
    });

    it('should return empty array for empty input', () => {
      const result = getUniqueDays([]);

      expect(result.length).toBe(0);
    });
  });

  describe('calculateStreakBonus', () => {
    it('should return 0 for streak less than 5', () => {
      expect(calculateStreakBonus(0)).toBe(0);
      expect(calculateStreakBonus(1)).toBe(0);
      expect(calculateStreakBonus(4)).toBe(0);
    });

    it('should return 10 for streak of 5-29 days', () => {
      expect(calculateStreakBonus(5)).toBe(10);
      expect(calculateStreakBonus(10)).toBe(10);
      expect(calculateStreakBonus(29)).toBe(10);
    });

    it('should return 25 for streak of 30+ days', () => {
      expect(calculateStreakBonus(30)).toBe(25);
      expect(calculateStreakBonus(50)).toBe(25);
      expect(calculateStreakBonus(100)).toBe(25);
    });
  });

  describe('formatStreak', () => {
    it('should format 0 streak', () => {
      expect(formatStreak(0)).toBe('Sin racha');
    });

    it('should format 1 day streak', () => {
      expect(formatStreak(1)).toBe('1 día');
    });

    it('should format multiple days streak', () => {
      expect(formatStreak(5)).toBe('5 días');
      expect(formatStreak(30)).toBe('30 días');
    });
  });

  describe('Timezone edge cases', () => {
    it('should handle UTC midnight crossing correctly', () => {
      // These dates are on different calendar days but are consecutive
      const lateNight = new Date('2024-01-15T23:30:00Z');
      const nextDay = new Date('2024-01-16T00:30:00Z');

      expect(isSameDay(lateNight, nextDay)).toBe(false);
      expect(isConsecutiveDay(lateNight, nextDay)).toBe(true);
    });

    it('should handle dates across month boundaries', () => {
      const jan31 = new Date('2024-01-31T12:00:00Z');
      const feb1 = new Date('2024-02-01T12:00:00Z');

      expect(isConsecutiveDay(jan31, feb1)).toBe(true);
    });

    it('should handle dates across year boundaries', () => {
      const dec31 = new Date('2023-12-31T12:00:00Z');
      const jan1 = new Date('2024-01-01T12:00:00Z');

      expect(isConsecutiveDay(dec31, jan1)).toBe(true);
    });

    it('should handle leap year correctly', () => {
      const feb28 = new Date('2024-02-28T12:00:00Z');
      const feb29 = new Date('2024-02-29T12:00:00Z');

      expect(isConsecutiveDay(feb28, feb29)).toBe(true);
    });
  });
});
