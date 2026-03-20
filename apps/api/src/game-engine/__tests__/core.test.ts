import { GameEngineCore } from '../core';
import { StrategyRegistry } from '../strategies/strategy-registry';
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

// Mock implementations
const createMockUGRepo = (overrides = {}): IUserGamificationRepository => ({
  findByUserId: jest.fn().mockResolvedValue(null),
  getOrCreate: jest.fn().mockResolvedValue(mockProfile()),
  addXP: jest.fn().mockResolvedValue({ newXP: 50, leveledUp: false }),
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

const mockProfile = (): GamificationProfile => ({
  userId: 'user-123',
  level: 1,
  levelTitle: 'Semilla',
  currentXP: 0,
  xpToNextLevel: 100,
  xpProgressPercent: 0,
  streak: 0,
  longestStreak: 0,
  totalBadges: 0,
  badges: [],
});

describe('GameEngineCore', () => {
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
    engine = new GameEngineCore(mockUGRepo, mockBadgeRepo, strategyRegistry);
  });

  describe('initialization', () => {
    it('should initialize without error', () => {
      expect(() => engine.initialize()).not.toThrow();
    });

    it('should subscribe to domain events on initialization', () => {
      const subscribeSpy = jest.spyOn(getEventBus(), 'subscribe');
      engine.initialize();
      expect(subscribeSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('shutdown', () => {
    it('should cleanup subscriptions', () => {
      engine.initialize();
      expect(() => engine.shutdown()).not.toThrow();
    });
  });

  describe('getProfile', () => {
    it('should return profile from repository', async () => {
      const profile = mockProfile();
      mockUGRepo.findByUserId = jest.fn().mockResolvedValue(profile);

      const result = await engine.getProfile('user-123');

      expect(mockUGRepo.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(profile);
    });

    it('should create profile if not found', async () => {
      mockUGRepo.findByUserId = jest.fn().mockResolvedValue(null);
      const newProfile = mockProfile();
      mockUGRepo.getOrCreate = jest.fn().mockResolvedValue(newProfile);

      const result = await engine.getProfile('user-123');

      expect(mockUGRepo.getOrCreate).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(newProfile);
    });
  });

  describe('XP handling', () => {
    it('should add XP when lesson is completed', async () => {
      engine.initialize();

      // Emit a lesson completed event
      const eventBus = getEventBus();
      await eventBus.emit('game:LESSON_COMPLETED', {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockUGRepo.addXP).toHaveBeenCalledWith('user-123', 50);
    });
  });

  describe('event emission', () => {
    it('should emit XP_CHANGED event after lesson completion', async () => {
      const emitSpy = jest.spyOn(getEventBus(), 'emit');
      engine.initialize();

      const eventBus = getEventBus();
      await eventBus.emit('game:LESSON_COMPLETED', {
        userId: 'user-123',
        lessonId: 'lesson-1',
        lessonTitle: 'Test Lesson',
        completedAt: new Date(),
      });

      // Wait for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(emitSpy).toHaveBeenCalledWith(
        'game:XP_CHANGED',
        expect.objectContaining({
          userId: 'user-123',
          delta: 50,
          source: 'LESSON_COMPLETED',
        }),
      );
    });
  });
});
