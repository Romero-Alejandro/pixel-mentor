import { StreakService } from '@/features/gamification/application/services/streak.service.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import type { IDailyActivityRepository } from '@/features/gamification/domain/ports/daily-activity.repository.port.js';

/** An activity timestamp on a given UTC day. */
function at(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

interface Harness {
  service: StreakService;
  record: (userId: string, date: Date) => Promise<unknown>;
  calendar: Date[];
  updates: Array<{ currentStreak: number; longestStreak: number; lastActivityAt: Date }>;
  profile: { currentStreak: number; longestStreak: number; lastActivityAt: Date | null };
}

function createHarness(stored?: {
  currentStreak?: number;
  longestStreak?: number;
  lastActivityAt?: Date | null;
}): Harness {
  const calendar: Date[] = [];
  const updates: Harness['updates'] = [];
  const profile: Harness['profile'] = {
    currentStreak: stored?.currentStreak ?? 0,
    longestStreak: stored?.longestStreak ?? 0,
    lastActivityAt: stored?.lastActivityAt ?? null,
  };

  const userGamificationRepo = {
    getOrCreate: jest.fn(async () => ({ ...profile })),
    updateStreak: jest.fn(
      async (
        _userId: string,
        data: { currentStreak: number; longestStreak: number; lastActivityAt: Date },
      ) => {
        updates.push(data);
        profile.currentStreak = data.currentStreak;
        profile.longestStreak = data.longestStreak;
        profile.lastActivityAt = data.lastActivityAt;
      },
    ),
  };

  const dailyActivityRepo = {
    recordActivity: jest.fn(async (_userId: string, date: Date) => {
      const day = new Date(date);
      day.setUTCHours(0, 0, 0, 0);
      if (!calendar.some((entry) => entry.getTime() === day.getTime())) {
        calendar.push(day);
      }
    }),
    getActivityDates: jest.fn(async (_userId: string, since?: Date) =>
      calendar
        .filter((entry) => !since || entry.getTime() >= since.getTime())
        .sort((a, b) => a.getTime() - b.getTime()),
    ),
  };

  const service = new StreakService(
    userGamificationRepo as unknown as IUserGamificationRepository,
    dailyActivityRepo as unknown as IDailyActivityRepository,
    { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
  );

  return {
    service,
    record: (userId, date) => service.recordActivity(userId, date),
    calendar,
    updates,
    profile,
  };
}

describe('StreakService', () => {
  it('starts a streak at 1 with no bonus on the first day', async () => {
    const harness = createHarness();

    const result = await harness.service.recordActivity('user-1', at('2026-03-01'));

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      isNewRecord: true,
      bonusXP: 0,
      streakWasBroken: false,
      activityDate: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(harness.calendar).toEqual([new Date('2026-03-01T00:00:00.000Z')]);
  });

  it('counts consecutive calendar days', async () => {
    const harness = createHarness();

    for (const day of ['2026-03-01', '2026-03-02', '2026-03-03']) {
      await harness.service.recordActivity('user-1', at(day));
    }

    expect(harness.profile.currentStreak).toBe(3);
    expect(harness.profile.longestStreak).toBe(3);
  });

  it('pays the bonus from the fifth consecutive day', async () => {
    const harness = createHarness();
    const days = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'];
    const bonuses: number[] = [];

    for (const day of days) {
      bonuses.push((await harness.service.recordActivity('user-1', at(day))).bonusXP);
    }

    expect(bonuses).toEqual([0, 0, 0, 0, 10]);
  });

  it('pays the top bonus from the thirtieth consecutive day', async () => {
    const harness = createHarness({
      longestStreak: 29,
      currentStreak: 29,
      lastActivityAt: at('2026-03-29'),
    });

    for (let index = 1; index <= 29; index++) {
      await harness.service.recordActivity(
        'user-1',
        at(`2026-03-${String(index).padStart(2, '0')}`),
      );
    }

    const result = await harness.service.recordActivity('user-1', at('2026-03-30'));

    expect(result.currentStreak).toBe(30);
    expect(result.bonusXP).toBe(25);
  });

  it('resets to 1 after a missed day and keeps the longest streak', async () => {
    const harness = createHarness();
    await harness.service.recordActivity('user-1', at('2026-03-01'));
    await harness.service.recordActivity('user-1', at('2026-03-02'));
    await harness.service.recordActivity('user-1', at('2026-03-03'));

    const result = await harness.service.recordActivity('user-1', at('2026-03-05'));

    expect(result).toMatchObject({
      currentStreak: 1,
      longestStreak: 3,
      streakWasBroken: true,
      isNewRecord: false,
      bonusXP: 0,
    });
  });

  it('is a no-op with no bonus on the same calendar day', async () => {
    const harness = createHarness();
    await harness.service.recordActivity('user-1', new Date('2026-03-01T08:00:00.000Z'));

    const result = await harness.service.recordActivity(
      'user-1',
      new Date('2026-03-01T22:30:00.000Z'),
    );

    expect(result).toMatchObject({ currentStreak: 1, bonusXP: 0, isNewRecord: false });
    expect(harness.calendar).toHaveLength(1);
    expect(harness.updates).toHaveLength(1);
  });

  it('treats consecutive calendar days as a streak even under 24 hours apart', async () => {
    // Regression guard: the old rule broke the streak when more than 24 hours had
    // passed, so 23:59 followed by 00:01 the next day reset the counter.
    const harness = createHarness();
    await harness.service.recordActivity('user-1', new Date('2026-03-01T23:59:00.000Z'));

    const result = await harness.service.recordActivity(
      'user-1',
      new Date('2026-03-02T00:01:00.000Z'),
    );

    expect(result.currentStreak).toBe(2);
    expect(result.streakWasBroken).toBe(false);
  });

  it('reports no break when the calendar is empty but a cached streak exists', async () => {
    // Legacy rows can carry a cached streak without a calendar; a single activity
    // must not claim a break it cannot prove.
    const harness = createHarness({
      currentStreak: 7,
      longestStreak: 7,
      lastActivityAt: at('2026-02-01'),
    });

    const result = await harness.service.recordActivity('user-1', at('2026-03-01'));

    expect(result).toMatchObject({ currentStreak: 1, longestStreak: 7, streakWasBroken: false });
  });
});
