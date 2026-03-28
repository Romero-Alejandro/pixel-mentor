/**
 * Gamification Flow Integration Tests (GAM-12)
 *
 * Tests the full gamification flow end-to-end with real service instances:
 * - Lesson Completion Flow → XP → Level → Badges
 * - Level Up Flow → XP threshold → level up event → new title
 * - Badge Award Flow → first_lesson badge, perfect_score badge
 * - Streak Flow → consecutive days → streak increases, missing day → streak resets
 * - Full Flow → Complete lesson → XP → level check → badge check → streak update
 *
 * Mock Setup:
 * - Prisma client fully mocked (database operations)
 * - EventBus: real InMemoryEventBus (reset between tests)
 * - Real services: GameEngineCore, StreakService, StrategyRegistry, BadgeEngine
 * - Mock repositories: IUserGamificationRepository, IBadgeRepository
 */

import { GameEngineCore } from '../core';
import { StrategyRegistry } from '../strategies/strategy-registry';
import type { IClock } from '../streak.service';
import { StreakService } from '../streak.service';
import {
  LessonCompletionStrategy,
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
  StreakBonusStrategy,
} from '../strategies';

import type {
  IUserGamificationRepository,
  IBadgeRepository,
  GamificationProfile,
} from '@/domain/ports/gamification-ports';
import { getEventBus, resetEventBus } from '@/events/event-bus';
import { GameDomainEvents, GameEngineEvents } from '@/events/game-events';
import type {
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedPayload,
} from '@/events/game-events';

// ─── Prisma Mock ────────────────────────────────────────────────────────────
// Mock the prisma client to prevent actual database calls
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    userGamification: {
      update: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    badge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userBadge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    levelConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userProgress: {
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    activityAttempt: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// ─── Test Helpers ────────────────────────────────────────────────────────────

/**
 * Creates a mock GamificationProfile with sensible defaults.
 */
const createMockProfile = (overrides: Partial<GamificationProfile> = {}): GamificationProfile => ({
  userId: 'user-123',
  level: 1,
  levelTitle: 'Semilla',
  currentXP: 0,
  xpToNextLevel: 100,
  xpProgressPercent: 0,
  streak: 0,
  longestStreak: 0,
  lastActivityAt: null,
  totalBadges: 0,
  badges: [],
  ...overrides,
});

/**
 * Creates a mock IUserGamificationRepository with configurable behavior.
 */
const createMockUGRepo = (
  overrides: Partial<IUserGamificationRepository> = {},
): IUserGamificationRepository => ({
  findByUserId: jest.fn().mockResolvedValue(null),
  getOrCreate: jest.fn().mockResolvedValue(createMockProfile()),
  addXP: jest.fn().mockResolvedValue({ newXP: 70, leveledUp: false }),
  updateStreak: jest.fn().mockResolvedValue(undefined),
  getLevelConfig: jest.fn().mockResolvedValue({ level: 1, title: 'Semilla', minXP: 0, icon: '🌱' }),
  getNextLevelConfig: jest
    .fn()
    .mockResolvedValue({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' }),
  ...overrides,
});

/**
 * Creates a mock IBadgeRepository with configurable behavior.
 */
const createMockBadgeRepo = (overrides: Partial<IBadgeRepository> = {}): IBadgeRepository => ({
  findAll: jest.fn().mockResolvedValue([]),
  findByCode: jest.fn().mockResolvedValue(null),
  awardBadge: jest.fn().mockResolvedValue(false),
  getUserBadges: jest.fn().mockResolvedValue([]),
  hasBadge: jest.fn().mockResolvedValue(false),
  ...overrides,
});

/**
 * Creates a StrategyRegistry with all production strategies registered.
 */
const createStrategyRegistry = (): StrategyRegistry => {
  const registry = new StrategyRegistry();
  registry.register(new LessonCompletionStrategy());
  registry.register(new FirstLessonBadgeStrategy());
  registry.register(new StreakMilestone7Strategy());
  registry.register(new StreakMilestone30Strategy());
  registry.register(new StreakBonusStrategy());
  return registry;
};

/**
 * Creates a mock StreakService with configurable login behavior.
 */
const createMockStreakService = (streakResultOverrides = {}): StreakService => {
  const mockClock: IClock = {
    now: jest.fn(() => new Date()),
  };
  const streakService = new StreakService(createMockUGRepo(), undefined, mockClock);

  jest.spyOn(streakService, 'recordDailyLogin').mockImplementation(async () => ({
    currentStreak: 1,
    longestStreak: 1,
    isNewRecord: true,
    bonusXP: 0,
    streakWasBroken: false,
    activityDate: new Date(),
    ...streakResultOverrides,
  }));

  return streakService;
};

/**
 * Helper to collect emitted events of a specific type from the EventBus.
 */
function collectEventsOfType<T>(emitSpy: jest.SpyInstance, eventType: string): T[] {
  return (emitSpy.mock.calls as Array<[string, unknown]>)
    .filter((call) => call[0] === eventType)
    .map((call) => call[1] as T);
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Gamification Flow Integration Tests (GAM-12)', () => {
  let engine: GameEngineCore;
  let mockUGRepo: IUserGamificationRepository;
  let mockBadgeRepo: IBadgeRepository;
  let strategyRegistry: StrategyRegistry;

  beforeEach(() => {
    resetEventBus();
    mockUGRepo = createMockUGRepo();
    mockBadgeRepo = createMockBadgeRepo();
    strategyRegistry = createStrategyRegistry();

    const mockStreakService = createMockStreakService();
    engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, mockStreakService);
  });

  afterEach(() => {
    engine.shutdown();
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LESSON COMPLETION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Lesson Completion Flow', () => {
    it('should add XP when user completes a lesson', async () => {
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Introducción a TypeScript',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // LessonCompletionStrategy awards 70 XP for perfect accuracy with all first attempts correct
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);
    });

    it('should emit XP_CHANGED event after lesson completion', async () => {
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Introducción a TypeScript',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const xpEvents = collectEventsOfType<XPChangedPayload>(emitSpy, GameEngineEvents.XP_CHANGED);
      expect(xpEvents.length).toBeGreaterThanOrEqual(1);
      expect(xpEvents[0]).toMatchObject({
        userId: 'user-123',
        delta: 70,
        source: 'LESSON_COMPLETED',
      });
    });

    it('should check level after XP is added', async () => {
      // Simulate XP added without level up
      mockUGRepo.addXP = jest.fn().mockResolvedValue({
        newXP: 50,
        leveledUp: false,
      });
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Introducción a TypeScript',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify addXP was called and no LEVEL_UP emitted
      expect(mockUGRepo.addXP).toHaveBeenCalled();
      const levelUpEvents = collectEventsOfType(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents).toHaveLength(0);
    });

    it('should award first_lesson badge on first lesson completion', async () => {
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'First Lesson',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // FirstLessonBadgeStrategy should award FIRST_LESSON badge
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'FIRST_LESSON');

      const badgeEvents = collectEventsOfType<BadgeEarnedPayload>(
        emitSpy,
        GameEngineEvents.BADGE_EARNED,
      );
      expect(badgeEvents.length).toBeGreaterThanOrEqual(1);
      expect(badgeEvents[0]).toMatchObject({
        userId: 'user-123',
        badgeCode: 'FIRST_LESSON',
      });
    });

    it('should not award first_lesson badge on subsequent completions', async () => {
      // User already has FIRST_LESSON badge
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([
        {
          code: 'FIRST_LESSON',
          name: 'Primera Lección',
          icon: '🌱',
          description: 'First lesson badge',
          earnedAt: new Date(),
        },
      ]);
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-2',
        lessonTitle: 'Second Lesson',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should NOT call awardBadge for FIRST_LESSON again
      expect(mockBadgeRepo.awardBadge).not.toHaveBeenCalledWith('user-123', 'FIRST_LESSON');
    });

    it('should award both XP and badge in a single lesson completion', async () => {
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'First Lesson Ever',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify XP was added
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);

      // Verify badge was awarded
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'FIRST_LESSON');

      // Verify both events emitted
      const xpEvents = collectEventsOfType(emitSpy, GameEngineEvents.XP_CHANGED);
      const badgeEvents = collectEventsOfType(emitSpy, GameEngineEvents.BADGE_EARNED);
      expect(xpEvents.length).toBeGreaterThanOrEqual(1);
      expect(badgeEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LEVEL UP FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Level Up Flow', () => {
    it('should emit LEVEL_UP event when crossing XP threshold', async () => {
      // Simulate XP that causes level up
      mockUGRepo.addXP = jest.fn().mockResolvedValueOnce({
        newXP: 100,
        leveledUp: true,
        newLevel: 2,
        newLevelTitle: 'Brote',
      });
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Level Up Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const levelUpEvents = collectEventsOfType<LevelUpPayload>(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents).toHaveLength(1);
      expect(levelUpEvents[0]).toMatchObject({
        userId: 'user-123',
        previousLevel: 1,
        newLevel: 2,
        newLevelTitle: 'Brote',
      });
    });

    it('should include correct level title in LEVEL_UP event', async () => {
      mockUGRepo.addXP = jest.fn().mockResolvedValueOnce({
        newXP: 250,
        leveledUp: true,
        newLevel: 3,
        newLevelTitle: 'Flor',
      });
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Third Level Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const levelUpEvents = collectEventsOfType<LevelUpPayload>(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents).toHaveLength(1);
      expect(levelUpEvents[0].newLevelTitle).toBe('Flor');
    });

    it('should include level icon in LEVEL_UP event', async () => {
      mockUGRepo.addXP = jest.fn().mockResolvedValueOnce({
        newXP: 100,
        leveledUp: true,
        newLevel: 2,
        newLevelTitle: 'Brote',
      });
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Level Up',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const levelUpEvents = collectEventsOfType<LevelUpPayload>(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents[0].newIcon).toBeDefined();
      expect(levelUpEvents[0].newIcon).not.toBe('');
    });

    it('should emit LEVEL_UP and XP_CHANGED together on level up', async () => {
      mockUGRepo.addXP = jest.fn().mockResolvedValueOnce({
        newXP: 150,
        leveledUp: true,
        newLevel: 2,
        newLevelTitle: 'Brote',
      });
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Level Up Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const xpEvents = collectEventsOfType(emitSpy, GameEngineEvents.XP_CHANGED);
      const levelUpEvents = collectEventsOfType(emitSpy, GameEngineEvents.LEVEL_UP);

      expect(xpEvents.length).toBeGreaterThanOrEqual(1);
      expect(levelUpEvents.length).toBe(1);
    });

    it('should handle level up from streak bonus XP on daily login', async () => {
      // Profile with 4-day streak (will become 5 after login, triggering bonus)
      const profile = createMockProfile({ streak: 4, longestStreak: 4 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      // First addXP: streak bonus XP causes level up
      mockUGRepo.addXP = jest.fn().mockResolvedValue({
        newXP: 120,
        leveledUp: true,
        newLevel: 2,
        newLevelTitle: 'Brote',
      });

      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);

      // Create streak service with bonus XP
      const streakService = createMockStreakService({
        currentStreak: 5,
        longestStreak: 5,
        bonusXP: 10,
        isNewRecord: true,
        streakWasBroken: false,
      });

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      // Emit DAILY_LOGIN (streak bonus strategy applies here, not LESSON_COMPLETED)
      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have emitted LEVEL_UP from streak bonus XP
      const levelUpEvents = collectEventsOfType(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. BADGE AWARD FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Badge Award Flow', () => {
    it('should award FIRST_LESSON badge on first lesson completion', async () => {
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Mi Primera Lección',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify badge was awarded through badge repository
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'FIRST_LESSON');

      // Verify BADGE_EARNED event emitted
      const badgeEvents = collectEventsOfType<BadgeEarnedPayload>(
        emitSpy,
        GameEngineEvents.BADGE_EARNED,
      );
      expect(badgeEvents.length).toBeGreaterThanOrEqual(1);
      expect(badgeEvents[0]).toMatchObject({
        userId: 'user-123',
        badgeCode: 'FIRST_LESSON',
        badgeName: 'Primera Lección',
        badgeIcon: '🌱',
      });
    });

    it('should award STREAK_7 badge when streak reaches 7 days', async () => {
      // User has 6-day streak, will become 7 after daily login
      const profile = createMockProfile({ streak: 6, longestStreak: 6 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      const streakService = createMockStreakService({
        currentStreak: 7,
        longestStreak: 7,
        bonusXP: 10,
        isNewRecord: true,
        streakWasBroken: false,
      });

      // After hitting 7-day streak, profile shows 7
      const updatedProfile = createMockProfile({ streak: 7, longestStreak: 7 });
      mockUGRepo.findByUserId = jest.fn().mockResolvedValue(updatedProfile);

      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify STREAK_7 badge was awarded
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'STREAK_7');
    });

    it('should not re-award badge user already has', async () => {
      // User already has FIRST_LESSON badge
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([
        {
          code: 'FIRST_LESSON',
          name: 'Primera Lección',
          icon: '🌱',
          description: 'First lesson',
          earnedAt: new Date(),
        },
      ]);
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-2',
        lessonTitle: 'Second Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not attempt to award FIRST_LESSON again
      expect(mockBadgeRepo.awardBadge).not.toHaveBeenCalledWith('user-123', 'FIRST_LESSON');
    });

    it('should handle perfect score activity attempt with bonus XP', async () => {
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: true,
        attemptNumber: 1,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Perfect attempt awards 20 XP bonus
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 20);
    });

    it('should not award XP for incorrect activity attempt', async () => {
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: false,
        attemptNumber: 1,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // XP should NOT be added for incorrect attempt
      expect(mockUGRepo.addXP).not.toHaveBeenCalled();
    });

    it('should not award XP for non-first attempt even if correct', async () => {
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: true,
        attemptNumber: 2,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // XP should NOT be added for second attempt
      expect(mockUGRepo.addXP).not.toHaveBeenCalled();
    });

    it('should emit BADGE_EARNED event with total badge count', async () => {
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'First Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const badgeEvents = collectEventsOfType<BadgeEarnedPayload>(
        emitSpy,
        GameEngineEvents.BADGE_EARNED,
      );
      expect(badgeEvents.length).toBeGreaterThanOrEqual(1);
      expect(badgeEvents[0].totalBadges).toBeDefined();
      expect(typeof badgeEvents[0].totalBadges).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. STREAK FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Streak Flow', () => {
    it('should increase streak on consecutive day login', async () => {
      const profile = createMockProfile({ streak: 3, longestStreak: 3 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      const streakService = createMockStreakService({
        currentStreak: 4,
        longestStreak: 4,
        bonusXP: 0,
        isNewRecord: true,
        streakWasBroken: false,
      });

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify STREAK_UPDATED event with correct streak values
      const streakEvents = collectEventsOfType<StreakUpdatedPayload>(
        emitSpy,
        GameEngineEvents.STREAK_UPDATED,
      );
      expect(streakEvents.length).toBeGreaterThanOrEqual(1);
      expect(streakEvents[0]).toMatchObject({
        userId: 'user-123',
        currentStreak: 4,
        streakBroken: false,
      });
    });

    it('should reset streak when day is missed', async () => {
      const profile = createMockProfile({ streak: 5, longestStreak: 5 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      // Streak service returns streakWasBroken = true
      const streakService = createMockStreakService({
        currentStreak: 1,
        longestStreak: 5,
        bonusXP: 0,
        isNewRecord: false,
        streakWasBroken: true,
      });

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify streak was reset
      const streakEvents = collectEventsOfType<StreakUpdatedPayload>(
        emitSpy,
        GameEngineEvents.STREAK_UPDATED,
      );
      expect(streakEvents.length).toBeGreaterThanOrEqual(1);
      expect(streakEvents[0]).toMatchObject({
        userId: 'user-123',
        currentStreak: 1,
        streakBroken: true,
      });
    });

    it('should emit streak bonus XP when streak reaches bonus threshold', async () => {
      const profile = createMockProfile({ streak: 4, longestStreak: 4 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      // 5-day streak qualifies for bonus XP
      const streakService = createMockStreakService({
        currentStreak: 5,
        longestStreak: 5,
        bonusXP: 10,
        isNewRecord: true,
        streakWasBroken: false,
      });

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify streak bonus XP was applied (streak bonus + strategy bonus)
      expect(mockUGRepo.addXP).toHaveBeenCalled();
      const addXPCall = (mockUGRepo.addXP as jest.Mock).mock.calls[0];
      expect(addXPCall[0]).toBe('user-123');
      expect(addXPCall[1]).toBeGreaterThanOrEqual(10);
    });

    it('should update longest streak when current exceeds it', async () => {
      const profile = createMockProfile({ streak: 6, longestStreak: 6 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      const streakService = createMockStreakService({
        currentStreak: 7,
        longestStreak: 7,
        bonusXP: 10,
        isNewRecord: true,
        streakWasBroken: false,
      });

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify longest streak is updated
      const streakEvents = collectEventsOfType<StreakUpdatedPayload>(
        emitSpy,
        GameEngineEvents.STREAK_UPDATED,
      );
      expect(streakEvents.length).toBeGreaterThanOrEqual(1);
      expect(streakEvents[0].longestStreak).toBe(7);
    });

    it('should preserve longest streak after streak break', async () => {
      const profile = createMockProfile({ streak: 5, longestStreak: 10 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(profile),
      });

      // Streak broke, but longestStreak preserved
      const streakService = createMockStreakService({
        currentStreak: 1,
        longestStreak: 10, // preserved
        bonusXP: 0,
        isNewRecord: false,
        streakWasBroken: true,
      });

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const streakEvents = collectEventsOfType<StreakUpdatedPayload>(
        emitSpy,
        GameEngineEvents.STREAK_UPDATED,
      );
      expect(streakEvents[0].longestStreak).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. FULL FLOW (Complete lesson → XP → level → badge → streak)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full Flow', () => {
    it('should process complete gamification flow on lesson completion', async () => {
      // Setup: new user, no badges, no streak
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);

      // XP added causes level up
      mockUGRepo.addXP = jest.fn().mockResolvedValue({
        newXP: 100,
        leveledUp: true,
        newLevel: 2,
        newLevelTitle: 'Brote',
      });

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Mi Primera Lección',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify XP was added
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);

      // Verify level up occurred
      const levelUpEvents = collectEventsOfType<LevelUpPayload>(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents.length).toBeGreaterThanOrEqual(1);
      expect(levelUpEvents[0]).toMatchObject({
        userId: 'user-123',
        newLevel: 2,
        newLevelTitle: 'Brote',
      });

      // Verify XP_CHANGED event
      const xpEvents = collectEventsOfType<XPChangedPayload>(emitSpy, GameEngineEvents.XP_CHANGED);
      expect(xpEvents.length).toBeGreaterThanOrEqual(1);

      // Verify badge was awarded
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'FIRST_LESSON');

      // Verify BADGE_EARNED event
      const badgeEvents = collectEventsOfType<BadgeEarnedPayload>(
        emitSpy,
        GameEngineEvents.BADGE_EARNED,
      );
      expect(badgeEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple lesson completions incrementally', async () => {
      // First lesson: XP + badge
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      mockUGRepo.addXP = jest.fn().mockResolvedValue({ newXP: 70, leveledUp: false });

      engine.initialize();

      // Complete first lesson
      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Lesson 1',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // After first lesson, user has FIRST_LESSON badge
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([
        {
          code: 'FIRST_LESSON',
          name: 'Primera Lección',
          icon: '🌱',
          description: 'First lesson',
          earnedAt: new Date(),
        },
      ]);

      // Second lesson: XP only (no new badge)
      mockUGRepo.addXP = jest
        .fn()
        .mockResolvedValue({ newXP: 100, leveledUp: true, newLevel: 2, newLevelTitle: 'Brote' });
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(false);

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-2',
        lessonTitle: 'Lesson 2',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // XP should have been added for second lesson
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);
    });

    it('should handle daily login → streak → bonus XP → level up chain', async () => {
      // After streak service updates the DB, profile should reflect streak 30
      // Strategies check the profile from buildRewardContext, so it must show 30
      const updatedProfile = createMockProfile({ streak: 30, longestStreak: 30 });
      mockUGRepo = createMockUGRepo({
        findByUserId: jest.fn().mockResolvedValue(updatedProfile),
      });

      // 30-day streak triggers both bonus XP and milestone
      const streakService = createMockStreakService({
        currentStreak: 30,
        longestStreak: 30,
        bonusXP: 25,
        isNewRecord: true,
        streakWasBroken: false,
      });

      // Bonus XP triggers level up
      mockUGRepo.addXP = jest.fn().mockResolvedValue({
        newXP: 500,
        leveledUp: true,
        newLevel: 4,
        newLevelTitle: 'Árbol',
      });

      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);

      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, streakService);

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify streak update
      const streakEvents = collectEventsOfType<StreakUpdatedPayload>(
        emitSpy,
        GameEngineEvents.STREAK_UPDATED,
      );
      expect(streakEvents.length).toBeGreaterThanOrEqual(1);
      expect(streakEvents[0].currentStreak).toBe(30);

      // Verify XP was added (streak bonus)
      expect(mockUGRepo.addXP).toHaveBeenCalled();

      // Verify level up from bonus XP
      const levelUpEvents = collectEventsOfType<LevelUpPayload>(emitSpy, GameEngineEvents.LEVEL_UP);
      expect(levelUpEvents.length).toBeGreaterThanOrEqual(1);

      // Verify STREAK_30 badge was attempted
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'STREAK_30');
    });

    it('should handle complete user journey: register → lessons → streak → badges', async () => {
      // Step 1: New user, first lesson
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      mockUGRepo.addXP = jest.fn().mockResolvedValue({ newXP: 70, leveledUp: false });

      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Getting Started',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify first lesson flow
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'FIRST_LESSON');

      // Step 2: Perfect activity attempt
      mockUGRepo.addXP = jest.fn().mockResolvedValue({ newXP: 70, leveledUp: false });

      await getEventBus().emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: true,
        attemptNumber: 1,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 20);

      // Verify all events were emitted
      const allCalls = (emitSpy.mock.calls as Array<[string, unknown]>).map((c) => c[0]);
      expect(allCalls).toContain(GameEngineEvents.XP_CHANGED);
      expect(allCalls).toContain(GameEngineEvents.BADGE_EARNED);
    });

    it('should handle error in event processing gracefully', async () => {
      // Mock repository to throw an error
      mockUGRepo.addXP = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);

      engine.initialize();

      // Should not throw even if internal processing fails
      await expect(
        getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
          userId: 'user-123',
          lessonId: 'lesson-1',
          lessonTitle: 'Error Test',
          completedAt: new Date(),
        }),
      ).resolves.not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Engine should still be functional
      expect(engine).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. STRATEGY EXECUTION ORDER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Strategy Execution Order', () => {
    it('should execute all applicable strategies in registration order', async () => {
      const executionOrder: string[] = [];
      const customRegistry = new StrategyRegistry();

      const tracker1 = {
        name: 'Tracker1',
        description: 'First',
        canApply: async () => true,
        getReward: async () => {
          executionOrder.push('tracker-1');
          return null;
        },
      };

      const tracker2 = {
        name: 'Tracker2',
        description: 'Second',
        canApply: async () => true,
        getReward: async () => {
          executionOrder.push('tracker-2');
          return null;
        },
      };

      customRegistry.register(tracker1);
      customRegistry.register(tracker2);

      const customEngine = new GameEngineCore(
        mockUGRepo,
        mockBadgeRepo,
        customRegistry,
        createMockStreakService(),
      );

      customEngine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Order Test',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(executionOrder).toEqual(['tracker-1', 'tracker-2']);
      customEngine.shutdown();
    });

    it('should skip strategies that do not apply to the event', async () => {
      // StreakBonusStrategy only applies to DAILY_LOGIN
      // On LESSON_COMPLETED, only LessonCompletionStrategy and FirstLessonBadgeStrategy apply
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Selective Strategy Test',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // XP should be from LessonCompletionStrategy (70 XP with bonus), not streak bonus
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PROFILE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Profile Management', () => {
    it('should auto-create profile when getProfile is called for new user', async () => {
      mockUGRepo.findByUserId = jest.fn().mockResolvedValue(null);
      mockUGRepo.getOrCreate = jest.fn().mockResolvedValue(createMockProfile());

      const profile = await engine.getProfile('new-user');

      expect(profile).toBeDefined();
      expect(profile.userId).toBe('user-123');
      expect(profile.level).toBe(1);
      expect(profile.currentXP).toBe(0);
    });

    it('should return existing profile for known user', async () => {
      const existingProfile = createMockProfile({
        userId: 'known-user',
        level: 3,
        currentXP: 250,
        streak: 7,
      });
      mockUGRepo.findByUserId = jest.fn().mockResolvedValue(existingProfile);

      const profile = await engine.getProfile('known-user');

      expect(profile).toEqual(existingProfile);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. ENGINE LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Engine Lifecycle', () => {
    it('should not process events after shutdown', async () => {
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      engine.initialize();
      engine.shutdown();

      // After shutdown, emit should not trigger any handler
      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Post Shutdown',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // addXP should NOT be called because the handler was unsubscribed
      expect(mockUGRepo.addXP).not.toHaveBeenCalled();
    });

    it('should allow re-initialization after shutdown', async () => {
      engine.initialize();
      engine.shutdown();

      // Re-initialize
      engine.initialize();

      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockUGRepo.addXP = jest.fn().mockResolvedValue({ newXP: 70, leveledUp: false });

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Re-init Test',
        completedAt: new Date(),
        accuracy: {
          correctFirstAttempts: 5,
          correctLastAttempts: 5,
          totalActivities: 5,
          skippedActivities: 0,
          accuracyPercent: 100,
          allCorrectOnFirstAttempt: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should work after re-init
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);
    });
  });
});
