/**
 * Integration tests for GameEngineCore with Strategy integration.
 *
 * Tests the full flow from domain events → strategy execution → gamification state updates → game engine events.
 */

import { GameEngineCore } from '../core';
import { StrategyRegistry } from '../strategies/strategy-registry';
import { StreakService, IClock } from '../streak.service';
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

// Mock prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    userGamification: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Mock implementations
const createMockUGRepo = (overrides = {}): IUserGamificationRepository => ({
  findByUserId: jest.fn().mockResolvedValue(null),
  getOrCreate: jest.fn().mockResolvedValue(mockProfile()),
  addXP: jest.fn().mockResolvedValue({ newXP: 70, leveledUp: false }),
  updateStreak: jest.fn().mockResolvedValue(undefined),
  getLevelConfig: jest.fn().mockResolvedValue({ level: 1, title: 'Semilla', minXP: 0, icon: '🌱' }),
  getNextLevelConfig: jest
    .fn()
    .mockResolvedValue({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' }),
  ...overrides,
});

const createMockBadgeRepo = (): IBadgeRepository => ({
  findAll: jest.fn().mockResolvedValue([]),
  findByCode: jest.fn().mockResolvedValue(null),
  awardBadge: jest.fn().mockResolvedValue(false),
  getUserBadges: jest.fn().mockResolvedValue([]),
  hasBadge: jest.fn().mockResolvedValue(false),
});

const createStrategyRegistry = (): StrategyRegistry => {
  const registry = new StrategyRegistry();
  registry.register(new LessonCompletionStrategy());
  registry.register(new FirstLessonBadgeStrategy());
  registry.register(new StreakMilestone7Strategy());
  registry.register(new StreakMilestone30Strategy());
  registry.register(new StreakBonusStrategy());
  return registry;
};

const mockProfile = (overrides = {}): GamificationProfile => ({
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

// Mock StreakService
const createMockStreakService = (profile: GamificationProfile): StreakService => {
  const mockClock: IClock = {
    now: jest.fn(() => new Date()),
  };
  const mockStreakService = new StreakService(
    createMockUGRepo({ findByUserId: jest.fn().mockResolvedValue(profile) }),
    undefined,
    mockClock,
  );

  // Mock the recordDailyLogin method
  jest.spyOn(mockStreakService, 'recordDailyLogin').mockImplementation(async () => ({
    currentStreak: profile.streak + 1,
    longestStreak: Math.max(profile.streak + 1, profile.longestStreak),
    isNewRecord: profile.streak + 1 > profile.longestStreak,
    bonusXP: profile.streak + 1 >= 5 ? 10 : 0,
    streakWasBroken: false,
    activityDate: new Date(),
  }));

  return mockStreakService;
};

describe('GameEngineCore Integration Tests', () => {
  let engine: GameEngineCore;
  let mockUGRepo: IUserGamificationRepository;
  let mockBadgeRepo: IBadgeRepository;
  let strategyRegistry: StrategyRegistry;

  beforeEach(() => {
    // Reset event bus before each test
    resetEventBus();

    mockUGRepo = createMockUGRepo();
    mockBadgeRepo = createMockBadgeRepo();
    strategyRegistry = createStrategyRegistry();

    // Create a default streak service for basic tests
    const mockStreakService = createMockStreakService(mockProfile());

    engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, mockStreakService);
  });

  afterEach(() => {
    engine.shutdown();
    jest.clearAllMocks();
  });

  describe('Strategy Integration', () => {
    it('should execute LessonCompletionStrategy on LESSON_COMPLETED event', async () => {
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify LessonCompletionStrategy was executed (XP added - 70 for perfect accuracy)
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 70);

      // Verify XP_CHANGED event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        GameEngineEvents.XP_CHANGED,
        expect.objectContaining({
          userId: 'user-123',
          delta: 50,
          source: 'LESSON_COMPLETED',
        }),
      );
    });

    it('should emit XP_CHANGED event after lesson completion', async () => {
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify XP_CHANGED event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        GameEngineEvents.XP_CHANGED,
        expect.objectContaining({
          userId: 'user-123',
          delta: 50,
          source: 'LESSON_COMPLETED',
        }),
      );
    });

    it('should award FirstLessonBadge on first lesson completion', async () => {
      // User has no badges yet
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify badge was awarded
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'FIRST_LESSON');

      // Verify BADGE_EARNED event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        GameEngineEvents.BADGE_EARNED,
        expect.objectContaining({
          userId: 'user-123',
          badgeCode: 'FIRST_LESSON',
        }),
      );
    });

    it('should not award FirstLessonBadge if user already has it', async () => {
      // User already has FIRST_LESSON badge
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([
        {
          code: 'FIRST_LESSON',
          name: 'Primera Lección',
          icon: '🌱',
          description: 'Badge description',
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

      // Badge should NOT be awarded again
      expect(mockBadgeRepo.awardBadge).not.toHaveBeenCalledWith('user-123', 'FIRST_LESSON');
    });
  });

  describe('Level Up Flow', () => {
    it('should emit LEVEL_UP event when crossing XP threshold', async () => {
      // Simulate XP that causes level up (adding 100 XP when at 0 should level up)
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
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify LEVEL_UP event was emitted with correct data
      expect(emitSpy).toHaveBeenCalledWith(
        GameEngineEvents.LEVEL_UP,
        expect.objectContaining({
          userId: 'user-123',
          previousLevel: 1,
          newLevel: 2,
          newLevelTitle: 'Brote',
        }),
      );
    });

    it('should include newLevelTitle in LEVEL_UP event', async () => {
      mockUGRepo.addXP = jest
        .fn()
        .mockResolvedValueOnce({ newXP: 250, leveledUp: true, newLevel: 3, newLevelTitle: 'Flor' });
      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Find LEVEL_UP event
      const levelUpCall = emitSpy.mock.calls.find(
        (call: [string, unknown]) => call[0] === GameEngineEvents.LEVEL_UP,
      );

      expect(levelUpCall).toBeDefined();
      const levelUpPayload = levelUpCall![1] as { newLevelTitle: string };
      expect(levelUpPayload.newLevelTitle).toBe('Flor');
    });
  });

  describe('Daily Login Flow', () => {
    it('should execute StreakBonusStrategy on DAILY_LOGIN event', async () => {
      // User with 5-day streak
      const profile = mockProfile({ streak: 5, longestStreak: 5 });

      // Create streak service with the profile
      const mockStreakService = createMockStreakService(profile);

      // Update engine with new streak service
      engine.shutdown();
      engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry, mockStreakService);

      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      const emitSpy = jest.spyOn(getEventBus(), 'emit');

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify STREAK_UPDATED event was emitted with expected values
      expect(emitSpy).toHaveBeenCalledWith(
        GameEngineEvents.STREAK_UPDATED,
        expect.objectContaining({
          userId: 'user-123',
          currentStreak: 6,
          longestStreak: 6,
          streakBroken: false,
        }),
      );
    });

    it('should award streak milestone badges', async () => {
      // User with 6-day streak (will become 7 after login)
      const profile = mockProfile({ streak: 6, longestStreak: 6 });

      // Updated profile after hitting 7-day streak
      const updatedProfile = mockProfile({ streak: 7, longestStreak: 7 });

      // Mock findByUserId to return updated profile (simulating DB update)
      mockUGRepo = createMockUGRepo({ findByUserId: jest.fn().mockResolvedValue(updatedProfile) });

      // Create streak service that returns 7-day streak
      const mockClock: IClock = {
        now: jest.fn(() => new Date()),
      };
      const mockStreakServiceFor7Days = new StreakService(
        createMockUGRepo({ findByUserId: jest.fn().mockResolvedValue(profile) }),
        undefined,
        mockClock,
      );
      jest.spyOn(mockStreakServiceFor7Days, 'recordDailyLogin').mockImplementation(async () => ({
        currentStreak: 7,
        longestStreak: 7,
        isNewRecord: false,
        bonusXP: 10,
        streakWasBroken: false,
        activityDate: new Date(),
      }));

      // Update engine with new repos and streak service
      engine.shutdown();
      engine = new GameEngineCore(
        mockUGRepo,
        mockBadgeRepo,
        strategyRegistry,
        mockStreakServiceFor7Days,
      );

      mockBadgeRepo.getUserBadges = jest.fn().mockResolvedValue([]);
      mockBadgeRepo.awardBadge = jest.fn().mockResolvedValue(true);

      engine.initialize();

      await getEventBus().emit(GameDomainEvents.DAILY_LOGIN, {
        userId: 'user-123',
        loginDate: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify 7-day streak badge was awarded
      expect(mockBadgeRepo.awardBadge).toHaveBeenCalledWith('user-123', 'STREAK_7');
    });
  });

  describe('Activity Attempt Flow', () => {
    it('should award bonus XP for perfect activity attempt', async () => {
      engine.initialize();

      const eventBus = getEventBus();
      await eventBus.emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: true,
        attemptNumber: 1,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify XP was added for perfect attempt (20 XP)
      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 20);
    });

    it('should not award bonus for incorrect attempt', async () => {
      engine.initialize();

      const eventBus = getEventBus();
      await eventBus.emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: false,
        attemptNumber: 1,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // XP should not be added for incorrect attempt
      expect(mockUGRepo.addXP).not.toHaveBeenCalled();
    });

    it('should not award bonus for second attempt even if correct', async () => {
      engine.initialize();

      const eventBus = getEventBus();
      await eventBus.emit(GameDomainEvents.ACTIVITY_ATTEMPT, {
        userId: 'user-123',
        activityId: 'activity-1',
        correct: true,
        attemptNumber: 2,
        hintUsed: false,
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // XP should not be added for non-first attempt
      expect(mockUGRepo.addXP).not.toHaveBeenCalled();
    });
  });

  describe('Strategy Execution Order', () => {
    it('should execute strategies in registration order', async () => {
      const executionOrder: string[] = [];
      const eventBus = getEventBus();

      // Create a custom registry that tracks execution order
      const customRegistry = new StrategyRegistry();

      // Register strategies that track execution
      const trackingStrategy1 = {
        name: 'TrackingStrategy1',
        description: 'First tracker',
        canApply: async () => true,
        getReward: async () => {
          executionOrder.push('1');
          return null;
        },
      };

      const trackingStrategy2 = {
        name: 'TrackingStrategy2',
        description: 'Second tracker',
        canApply: async () => true,
        getReward: async () => {
          executionOrder.push('2');
          return null;
        },
      };

      customRegistry.register(trackingStrategy1);
      customRegistry.register(trackingStrategy2);

      const customEngine = new GameEngineCore(
        mockUGRepo,
        mockBadgeRepo,
        customRegistry,
        createMockStreakService(mockProfile()),
      );
      customEngine.initialize();

      await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify strategies executed in order
      expect(executionOrder).toEqual(['1', '2']);
    });
  });
});
