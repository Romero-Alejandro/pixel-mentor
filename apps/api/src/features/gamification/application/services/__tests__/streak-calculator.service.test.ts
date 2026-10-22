import {
  addDaysUTC,
  calculateStreakBonus,
  calculateStreakFromActivities,
  getStartOfDayUTC,
  isConsecutiveDay,
  isSameDay,
  normalizeCurrentStreak,
} from '@/features/gamification/application/services/streak-calculator.service.js';

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('streak calculator', () => {
  describe('getStartOfDayUTC', () => {
    it('normalizes to midnight UTC regardless of the time', () => {
      expect(getStartOfDayUTC(new Date('2026-03-01T23:59:59.999Z'))).toEqual(day('2026-03-01'));
    });
  });

  describe('isSameDay / isConsecutiveDay', () => {
    it('compares UTC calendar days, not elapsed hours', () => {
      expect(
        isSameDay(new Date('2026-03-01T00:01:00.000Z'), new Date('2026-03-01T23:59:00.000Z')),
      ).toBe(true);
      expect(
        isConsecutiveDay(
          new Date('2026-03-01T23:59:00.000Z'),
          new Date('2026-03-02T00:01:00.000Z'),
        ),
      ).toBe(true);
      expect(isConsecutiveDay(day('2026-03-01'), day('2026-03-03'))).toBe(false);
    });
  });

  describe('addDaysUTC', () => {
    it('walks calendar days across month boundaries', () => {
      expect(addDaysUTC(day('2026-03-01'), -1)).toEqual(day('2026-02-28'));
      expect(addDaysUTC(day('2026-03-31'), 1)).toEqual(day('2026-04-01'));
    });
  });

  describe('calculateStreakFromActivities', () => {
    it('counts the run ending on the reference day', () => {
      const info = calculateStreakFromActivities(
        [day('2026-03-01'), day('2026-03-02'), day('2026-03-03')],
        0,
        day('2026-03-03'),
      );

      expect(info.currentStreak).toBe(3);
      expect(info.longestStreak).toBe(3);
      expect(info.isNewRecord).toBe(true);
    });

    it('keeps the streak alive when the last activity was yesterday', () => {
      const info = calculateStreakFromActivities(
        [day('2026-03-01'), day('2026-03-02')],
        0,
        day('2026-03-03'),
      );

      expect(info.currentStreak).toBe(2);
    });

    it('drops the current streak after a full missed day but keeps the record', () => {
      const info = calculateStreakFromActivities(
        [day('2026-03-01'), day('2026-03-02'), day('2026-03-03')],
        0,
        day('2026-03-05'),
      );

      expect(info.currentStreak).toBe(0);
      expect(info.longestStreak).toBe(3);
    });

    it('collapses duplicate days and never reports a lower record', () => {
      const info = calculateStreakFromActivities(
        [day('2026-03-01'), day('2026-03-01'), day('2026-03-02')],
        9,
        day('2026-03-02'),
      );

      expect(info.currentStreak).toBe(2);
      expect(info.longestStreak).toBe(9);
      expect(info.isNewRecord).toBe(false);
    });

    it('returns an empty result for no activities', () => {
      expect(calculateStreakFromActivities([], 4, day('2026-03-02'))).toMatchObject({
        currentStreak: 0,
        longestStreak: 4,
        isNewRecord: false,
      });
    });
  });

  describe('calculateStreakBonus', () => {
    it('pays 0 below 5 days, 10 from 5 and 25 from 30', () => {
      expect([0, 1, 4].map(calculateStreakBonus)).toEqual([0, 0, 0]);
      expect([5, 29].map(calculateStreakBonus)).toEqual([10, 10]);
      expect([30, 500].map(calculateStreakBonus)).toEqual([25, 25]);
    });
  });

  describe('normalizeCurrentStreak', () => {
    const reference = new Date('2026-03-10T15:00:00.000Z');

    it('keeps a streak whose last activity was today or yesterday', () => {
      expect(normalizeCurrentStreak(7, new Date('2026-03-10T08:00:00.000Z'), reference)).toBe(7);
      expect(normalizeCurrentStreak(7, new Date('2026-03-09T23:00:00.000Z'), reference)).toBe(7);
    });

    it('returns 0 when a full day was missed', () => {
      expect(normalizeCurrentStreak(7, new Date('2026-03-08T23:59:00.000Z'), reference)).toBe(0);
    });

    it('returns 0 without activity or with a non-positive streak', () => {
      expect(normalizeCurrentStreak(7, null, reference)).toBe(0);
      expect(normalizeCurrentStreak(0, new Date('2026-03-10T08:00:00.000Z'), reference)).toBe(0);
    });
  });
});
