/**
 * Unit tests for StreakService.
 */

import { StreakService, IClock, SystemClock } from '../streak.service';
import type {
  IUserGamificationRepository,
  GamificationProfile,
} from '@/domain/ports/gamification-ports';

// Mock prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    userGamification: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    dailyActivity: {
      upsert: jest.fn(),
    },
  },
}));

describe('StreakService', () => {
  let streakService: StreakService;
  let mockRepository: jest.Mocked<IUserGamificationRepository>;
  let mockClock: IClock;

  // Use a fixed reference date for consistent testing
  const REFERENCE_DATE = new Date('2024-03-15T12:00:00Z');

  // Helper to get dates relative to reference
  // Helper to get dates relative to reference - uses same time as reference
  const daysAgo = (days: number): Date => {
    const d = new Date(REFERENCE_DATE);
    d.setUTCDate(d.getUTCDate() - days);
    // Keep the same hour/minute/second as reference (12:00 UTC)
    return d;
  };

  const createMockProfile = (
    overrides: Partial<GamificationProfile> = {},
  ): GamificationProfile => ({
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

  beforeEach(() => {
    mockRepository = {
      findByUserId: jest.fn(),
      getOrCreate: jest.fn(),
      addXP: jest.fn(),
      updateStreak: jest.fn(),
      getLevelConfig: jest.fn(),
      getNextLevelConfig: jest.fn(),
    } as jest.Mocked<IUserGamificationRepository>;

    // Create mock clock that returns the reference date
    mockClock = {
      now: jest.fn(() => REFERENCE_DATE),
    };

    streakService = new StreakService(mockRepository, undefined, mockClock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordActivity', () => {
    it('should start a new streak of 1 for new user', async () => {
      const mockProfile = createMockProfile({
        lastActivityAt: null,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue({
        ...mockProfile,
        lastActivityAt: daysAgo(0),
      });

      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      const result = await streakService.recordActivity('user-123', daysAgo(0));

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.isNewRecord).toBe(true);
      expect(result.bonusXP).toBe(0);
      // For a new user, streakWasBroken is false (no previous streak to break)
      expect(result.streakWasBroken).toBe(false);
    });

    it('should increment streak for consecutive day activity', async () => {
      const yesterday = daysAgo(1);
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 5,
        lastActivityAt: yesterday,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue({
        ...mockProfile,
        lastActivityAt: today,
      });

      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      const result = await streakService.recordActivity('user-123', today);

      expect(result.currentStreak).toBe(6);
      expect(result.longestStreak).toBe(6);
      expect(result.isNewRecord).toBe(true);
      expect(result.bonusXP).toBe(10);
      expect(result.streakWasBroken).toBe(false);
    });

    it('should not increment streak for same day activity', async () => {
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 5,
        lastActivityAt: today,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.recordActivity('user-123', today);

      expect(result.currentStreak).toBe(5);
      expect(result.longestStreak).toBe(5);
      expect(result.isNewRecord).toBe(false);
      expect(result.bonusXP).toBe(0);
    });

    it('should break streak after missing a day', async () => {
      const twoDaysAgo = daysAgo(2);
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 5,
        lastActivityAt: twoDaysAgo,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue({
        ...mockProfile,
        lastActivityAt: today,
      });

      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      const result = await streakService.recordActivity('user-123', today);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(5);
      expect(result.isNewRecord).toBe(false);
      expect(result.bonusXP).toBe(0);
      expect(result.streakWasBroken).toBe(true);
    });

    it('should calculate bonus XP for 5-day streak', async () => {
      const yesterday = daysAgo(1);
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 4,
        longestStreak: 4,
        lastActivityAt: yesterday,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue({
        ...mockProfile,
        streak: 5,
        longestStreak: 5,
        lastActivityAt: today,
      });

      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      const result = await streakService.recordActivity('user-123', today);

      expect(result.currentStreak).toBe(5);
      expect(result.bonusXP).toBe(10);
    });

    it('should calculate bonus XP for 30-day streak', async () => {
      const yesterday = daysAgo(1);
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 29,
        longestStreak: 29,
        lastActivityAt: yesterday,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue({
        ...mockProfile,
        streak: 30,
        longestStreak: 30,
        lastActivityAt: today,
      });

      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      const result = await streakService.recordActivity('user-123', today);

      expect(result.currentStreak).toBe(30);
      expect(result.bonusXP).toBe(25);
    });
  });

  describe('getCurrentStreak', () => {
    it('should return 0 for user with no activity', async () => {
      mockRepository.findByUserId.mockResolvedValue(null);

      const result = await streakService.getCurrentStreak('user-123');

      expect(result).toBe(0);
    });

    it('should return 0 for expired streak (3+ days ago)', async () => {
      const threeDaysAgo = daysAgo(3);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 5,
        lastActivityAt: threeDaysAgo,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.getCurrentStreak('user-123');

      expect(result).toBe(0);
    });

    it('should return current streak when active (yesterday)', async () => {
      const yesterday = daysAgo(1);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 5,
        lastActivityAt: yesterday,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.getCurrentStreak('user-123');

      expect(result).toBe(5);
    });

    it('should return current streak when active (today)', async () => {
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 5,
        lastActivityAt: today,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.getCurrentStreak('user-123');

      expect(result).toBe(5);
    });
  });

  describe('getLongestStreak', () => {
    it('should return 0 for user with no activity', async () => {
      mockRepository.findByUserId.mockResolvedValue(null);

      const result = await streakService.getLongestStreak('user-123');

      expect(result).toBe(0);
    });

    it('should return longest streak from profile', async () => {
      const mockProfile = createMockProfile({
        streak: 3,
        longestStreak: 7,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.getLongestStreak('user-123');

      expect(result).toBe(7);
    });
  });

  describe('isStreakActive', () => {
    it('should return false for user with no activity', async () => {
      mockRepository.findByUserId.mockResolvedValue(null);

      const result = await streakService.isStreakActive('user-123');

      expect(result).toBe(false);
    });

    it('should return false for expired streak (3+ days ago)', async () => {
      const threeDaysAgo = daysAgo(3);

      const mockProfile = createMockProfile({
        streak: 5,
        lastActivityAt: threeDaysAgo,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.isStreakActive('user-123');

      expect(result).toBe(false);
    });

    it('should return true for active streak (yesterday)', async () => {
      const yesterday = daysAgo(1);

      const mockProfile = createMockProfile({
        streak: 5,
        lastActivityAt: yesterday,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.isStreakActive('user-123');

      expect(result).toBe(true);
    });

    it('should return true for active streak (today)', async () => {
      const today = daysAgo(0);

      const mockProfile = createMockProfile({
        streak: 5,
        lastActivityAt: today,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.isStreakActive('user-123');

      expect(result).toBe(true);
    });
  });

  describe('breakStreak', () => {
    it('should set streak to 0 and clear lastActivityAt', async () => {
      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      await streakService.breakStreak('user-123');

      expect(prisma.userGamification.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          currentStreak: 0,
          lastActivityAt: null,
        },
      });
    });
  });

  describe('getStreakInfo', () => {
    it('should return null for non-existent user', async () => {
      mockRepository.findByUserId.mockResolvedValue(null);

      const result = await streakService.getStreakInfo('user-123');

      expect(result).toBeNull();
    });

    it('should return full streak info for active streak', async () => {
      const yesterday = daysAgo(1);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 7,
        lastActivityAt: yesterday,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.getStreakInfo('user-123');

      expect(result).not.toBeNull();
      expect(result!.currentStreak).toBe(5);
      expect(result!.longestStreak).toBe(7);
      expect(result!.isNewRecord).toBe(false);
      expect(result!.bonusXP).toBe(10);
      expect(result!.streakWasBroken).toBe(false);
    });

    it('should return 0 streak for broken streak', async () => {
      const threeDaysAgo = daysAgo(3);

      const mockProfile = createMockProfile({
        streak: 5,
        longestStreak: 7,
        lastActivityAt: threeDaysAgo,
      });

      mockRepository.findByUserId.mockResolvedValue(mockProfile);

      const result = await streakService.getStreakInfo('user-123');

      expect(result).not.toBeNull();
      expect(result!.currentStreak).toBe(0);
      expect(result!.longestStreak).toBe(7);
      expect(result!.streakWasBroken).toBe(true);
      expect(result!.bonusXP).toBe(0);
    });
  });

  describe('recordDailyLogin', () => {
    it('should call recordActivity with login date', async () => {
      const loginDate = daysAgo(0);
      const mockProfile = createMockProfile({
        lastActivityAt: null,
      });

      mockRepository.getOrCreate.mockResolvedValue(mockProfile);
      mockRepository.findByUserId.mockResolvedValue({
        ...mockProfile,
        lastActivityAt: loginDate,
      });

      const { prisma } = require('@/infrastructure/adapters/database/client');
      prisma.userGamification.update.mockResolvedValue({});

      const result = await streakService.recordDailyLogin('user-123', loginDate);

      expect(result.currentStreak).toBe(1);
    });
  });
});

describe('SystemClock', () => {
  it('should return current date', () => {
    const clock = new SystemClock();
    const before = new Date();
    const now = clock.now();
    const after = new Date();

    expect(now.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
