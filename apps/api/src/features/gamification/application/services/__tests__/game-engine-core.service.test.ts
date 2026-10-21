import { GameEngineCore } from '@/features/gamification/application/services/game-engine-core.service.js';
import type {
  AwardXpOutcome,
  AwardXpService,
} from '@/features/gamification/application/services/award-xp.service.js';
import type { BadgeAwardService } from '@/features/gamification/application/services/badge-award.service.js';
import type { StreakService } from '@/features/gamification/application/services/streak.service.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { EventBus } from '@/shared/events/event-bus.port';
import type { DailyLoginPayload, LessonCompletedPayload } from '@/shared/events/game-events.port';
import { GameDomainEvents, GameEngineEvents } from '@/shared/events/game-events.port';

function awardOutcome(overrides: Partial<AwardXpOutcome> = {}): AwardXpOutcome {
  return {
    awarded: true,
    duplicate: false,
    xpAwarded: 70,
    previousTotalXP: 0,
    newTotalXP: 70,
    previousLevel: 1,
    newLevel: 1,
    leveledUp: false,
    ...overrides,
  };
}

interface Harness {
  engine: GameEngineCore;
  handlers: Map<string, (payload: unknown) => Promise<void>>;
  emit: jest.Mock;
  awardXp: jest.Mock;
  badgeAward: jest.Mock;
  recordDailyLogin: jest.Mock;
  markMastered: jest.Mock;
  calls: string[];
}

function createHarness(): Harness {
  const calls: string[] = [];
  const handlers = new Map<string, (payload: unknown) => Promise<void>>();

  const eventBus = {
    subscribe: jest.fn((event: string, handler: (payload: unknown) => Promise<void>) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    }),
    emit: jest.fn().mockResolvedValue(undefined),
  };

  const awardXp = jest.fn().mockImplementation(() => {
    calls.push('award-xp');
    return Promise.resolve(awardOutcome());
  });

  const badgeAward = jest.fn().mockImplementation(() => {
    calls.push('award-badges');
    return Promise.resolve({ badges: [], xp: null });
  });

  const markMastered = jest.fn().mockImplementation(() => {
    calls.push('mark-mastered');
    return Promise.resolve(undefined);
  });

  const recordDailyLogin = jest.fn().mockResolvedValue({
    currentStreak: 5,
    longestStreak: 5,
    isNewRecord: true,
    bonusXP: 10,
    streakWasBroken: false,
    activityDate: new Date('2026-10-21T00:00:00.000Z'),
  });

  const engine = new GameEngineCore(
    {
      findByUserId: jest.fn().mockResolvedValue({ totalBadges: 1 }),
    } as unknown as IUserGamificationRepository,
    { recordDailyLogin } as unknown as StreakService,
    {
      findOrCreateByUserAndRecipe: markMastered,
    } as unknown as ProgressRepository,
    { award: awardXp } as unknown as AwardXpService,
    { awardApplicable: badgeAward } as unknown as BadgeAwardService,
    eventBus as unknown as EventBus,
    { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } as never,
  );

  engine.initialize();

  return {
    engine,
    handlers,
    emit: eventBus.emit,
    awardXp,
    badgeAward,
    recordDailyLogin,
    markMastered,
    calls,
  };
}

const lessonPayload: LessonCompletedPayload = {
  userId: 'user-1',
  lessonId: 'lesson-1',
  lessonTitle: 'Lesson',
  completedAt: new Date(),
  accuracy: {
    correctFirstAttempts: 3,
    correctLastAttempts: 3,
    totalActivities: 3,
    skippedActivities: 0,
    accuracyPercent: 100,
    allCorrectOnFirstAttempt: true,
  },
};

const loginPayload: DailyLoginPayload = {
  userId: 'user-1',
  loginDate: new Date('2026-10-21T09:00:00.000Z'),
};

describe('GameEngineCore', () => {
  it('subscribes to lesson completion and daily login', () => {
    const harness = createHarness();

    expect(Array.from(harness.handlers.keys())).toEqual([
      GameDomainEvents.LESSON_COMPLETED,
      GameDomainEvents.DAILY_LOGIN,
    ]);
  });

  it('pays lesson XP, then marks the lesson, then evaluates badges', async () => {
    const harness = createHarness();

    await harness.handlers.get(GameDomainEvents.LESSON_COMPLETED)!(lessonPayload);

    expect(harness.calls).toEqual(['award-xp', 'mark-mastered', 'award-badges']);
    expect(harness.awardXp).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 70,
      source: 'LESSON',
      sourceRef: 'lesson-1',
    });
  });

  it('does not mark a lesson as mastered before the badge rules can see it', async () => {
    // Regression guard: the old order evaluated badges first, so a LESSON_COUNT
    // rule was always one lesson behind.
    const harness = createHarness();
    let masteredWhenBadgesRan = false;
    harness.badgeAward.mockImplementation(() => {
      masteredWhenBadgesRan = harness.markMastered.mock.calls.length > 0;
      return Promise.resolve({ badges: [], xp: null });
    });

    await harness.handlers.get(GameDomainEvents.LESSON_COMPLETED)!(lessonPayload);

    expect(masteredWhenBadgesRan).toBe(true);
  });

  it('emits XP_CHANGED for the lesson award', async () => {
    const harness = createHarness();

    await harness.handlers.get(GameDomainEvents.LESSON_COMPLETED)!(lessonPayload);

    expect(harness.emit).toHaveBeenCalledWith(
      GameEngineEvents.XP_CHANGED,
      expect.objectContaining({ userId: 'user-1', delta: 70, source: 'LESSON' }),
    );
  });

  it('emits nothing XP-related for a duplicate lesson completion', async () => {
    const harness = createHarness();
    harness.awardXp.mockResolvedValue(
      awardOutcome({ awarded: false, duplicate: true, xpAwarded: 0 }),
    );

    await harness.handlers.get(GameDomainEvents.LESSON_COMPLETED)!(lessonPayload);

    const emitted = harness.emit.mock.calls.map(([event]) => event);
    expect(emitted).not.toContain(GameEngineEvents.XP_CHANGED);
    expect(emitted).not.toContain(GameEngineEvents.LEVEL_UP);
  });

  it('pays the streak bonus exactly once per daily login', async () => {
    // Regression guard: the engine used to add StreakService.bonusXP to a
    // strategy bonus with the same thresholds, paying 5+ day streaks twice.
    const harness = createHarness();

    await harness.handlers.get(GameDomainEvents.DAILY_LOGIN)!(loginPayload);

    expect(harness.awardXp).toHaveBeenCalledTimes(1);
    expect(harness.awardXp).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 10,
      source: 'STREAK_DAILY',
      sourceRef: '2026-10-21',
    });
  });

  it('emits the streak update with the bonus that was actually paid', async () => {
    const harness = createHarness();

    await harness.handlers.get(GameDomainEvents.DAILY_LOGIN)!(loginPayload);

    expect(harness.emit).toHaveBeenCalledWith(
      GameEngineEvents.STREAK_UPDATED,
      expect.objectContaining({ currentStreak: 5, streakBonusXP: 10 }),
    );
  });

  it('announces badges and pays their XP after the streak award', async () => {
    const harness = createHarness();
    harness.badgeAward.mockResolvedValue({
      badges: [{ code: 'STREAK_7', name: 'Racha de 7', icon: '🔥', xpReward: 50 }],
      xp: {
        xpAwarded: 50,
        previousTotalXP: 10,
        newTotalXP: 60,
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
      },
    });

    await harness.handlers.get(GameDomainEvents.DAILY_LOGIN)!(loginPayload);

    const emitted = harness.emit.mock.calls.map(([event]) => event);
    expect(emitted).toContain(GameEngineEvents.BADGE_EARNED);
    expect(emitted).toContain(GameEngineEvents.XP_CHANGED);
    expect(harness.emit).toHaveBeenCalledWith(
      GameEngineEvents.BADGE_EARNED,
      expect.objectContaining({ badgeCode: 'STREAK_7', totalBadges: 1 }),
    );
    expect(harness.emit).toHaveBeenCalledWith(
      GameEngineEvents.XP_CHANGED,
      expect.objectContaining({ source: 'BADGE', delta: 50 }),
    );
  });

  it('logs a failed event instead of throwing', async () => {
    const harness = createHarness();
    harness.awardXp.mockRejectedValue(new Error('boom'));

    await expect(
      harness.handlers.get(GameDomainEvents.LESSON_COMPLETED)!(lessonPayload),
    ).resolves.toBeUndefined();
  });
});
