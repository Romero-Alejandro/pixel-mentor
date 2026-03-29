/**
 * Unit tests for PrismaUserGamificationRepository.
 */

import { PrismaUserGamificationRepository } from '../prisma-user-gamification.repository';

// Mock the prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    userGamification: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    levelConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    badge: {
      findUnique: jest.fn(),
    },
    userBadge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaUserGamificationRepository', () => {
  let repository: PrismaUserGamificationRepository;

  beforeEach(() => {
    repository = new PrismaUserGamificationRepository();
    jest.clearAllMocks();
    // Mock $transaction to execute callback with the prisma mock
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => await fn(prisma));
  });

  describe('findByUserId', () => {
    it('should return null when user gamification not found', async () => {
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByUserId('user-123');

      expect(result).toBeNull();
      expect(prisma.userGamification.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          badges: {
            include: {
              badge: true,
            },
          },
        },
      });
    });

    it('should return profile with badges when found', async () => {
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        totalXP: 150,
        currentStreak: 5,
        longestStreak: 10,
        level: 2,
        lastActivityAt: new Date(),
        badges: [
          {
            badge: {
              code: 'FIRST_LESSON',
              name: 'Primera Lección',
              icon: '🌱',
              description: 'Completaste tu primera lección',
            },
            earnedAt: new Date(),
          },
        ],
      });

      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' })
        .mockResolvedValueOnce({ level: 3, title: 'Flor', minXP: 250, icon: '🌸' });

      const result = await repository.findByUserId('user-123');

      expect(result).toEqual({
        userId: 'user-123',
        level: 2,
        levelTitle: 'Brote',
        currentXP: 150,
        xpToNextLevel: 150,
        xpProgressPercent: 33,
        streak: 5,
        longestStreak: 10,
        lastActivityAt: expect.any(Date),
        totalBadges: 1,
        badges: [
          {
            code: 'FIRST_LESSON',
            name: 'Primera Lección',
            icon: '🌱',
            description: 'Completaste tu primera lección',
            earnedAt: expect.any(Date),
          },
        ],
      });
    });
  });

  describe('getOrCreate', () => {
    it('should return existing gamification when found', async () => {
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        badges: [],
      });

      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 1, title: 'Semilla', minXP: 0, icon: '🌱' })
        .mockResolvedValueOnce({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' });

      const result = await repository.getOrCreate('user-123');

      expect(result.userId).toBe('user-123');
      expect(result.level).toBe(1);
      expect(prisma.userGamification.create).not.toHaveBeenCalled();
    });

    it('should create new gamification when not found', async () => {
      (prisma.userGamification.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // Initial check
        .mockResolvedValueOnce({
          // After creation - include badges
          userId: 'user-123',
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        });

      (prisma.userGamification.create as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        badges: [],
      });

      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 1, title: 'Semilla', minXP: 0, icon: '🌱' })
        .mockResolvedValueOnce({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' });

      const result = await repository.getOrCreate('user-123');

      expect(prisma.userGamification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
        },
        include: {
          badges: {
            include: {
              badge: true,
            },
          },
        },
      });
      expect(result.userId).toBe('user-123');
    });
  });

  describe('addXP', () => {
    it('should add XP and return updated values', async () => {
      // Mock getOrCreate behavior
      (prisma.userGamification.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          // Before addXP - used by getOrCreate
          userId: 'user-123',
          totalXP: 50,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        })
        .mockResolvedValueOnce({
          // Before update
          userId: 'user-123',
          totalXP: 50,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        })
        .mockResolvedValueOnce({
          // After update
          userId: 'user-123',
          totalXP: 100,
          currentStreak: 0,
          longestStreak: 0,
          level: 2,
          badges: [],
        });

      (prisma.userGamification.update as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        totalXP: 100,
        currentStreak: 0,
        longestStreak: 0,
        level: 2,
      });

      // Mock level configs
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const result = await repository.addXP('user-123', 50);

      expect(result.newXP).toBe(100);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.newLevelTitle).toBe('Brote');
    });

    it('should add XP without level up when threshold not reached', async () => {
      // Mock sequence:
      // 1. getOrCreate - returns existing gamification (100 XP, level 1)
      // 2. findUnique before update (to get old XP)
      // 3. After update, calculateLevel checks (returns level 1 for 130 XP total)
      // 4. Final findUnique for level check

      (prisma.userGamification.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          // getOrCreate call
          userId: 'user-123',
          totalXP: 100,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        })
        .mockResolvedValueOnce({
          // Before update
          userId: 'user-123',
          totalXP: 100,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        })
        .mockResolvedValueOnce({
          // After update - 130 XP total (100 + 30)
          userId: 'user-123',
          totalXP: 130,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        });

      (prisma.userGamification.update as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        totalXP: 130,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      });

      // Level 2 requires 100 XP minimum, so 130 XP stays at level 1
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const result = await repository.addXP('user-123', 30);

      expect(result.newXP).toBe(130);
      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBeUndefined();
    });
  });

  describe('updateStreak', () => {
    it('should update streak data', async () => {
      (prisma.userGamification.update as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        totalXP: 100,
        currentStreak: 5,
        longestStreak: 10,
        level: 2,
      });

      await repository.updateStreak('user-123', 5, 10);

      expect(prisma.userGamification.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          currentStreak: 5,
          longestStreak: 10,
          lastActivityAt: expect.any(Date),
        },
      });
    });
  });

  describe('getLevelConfig', () => {
    it('should return level config when found', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValue({
        level: 3,
        title: 'Flor',
        minXP: 250,
        icon: '🌸',
      });

      const result = await repository.getLevelConfig(3);

      expect(result).toEqual({
        level: 3,
        title: 'Flor',
        minXP: 250,
        icon: '🌸',
      });
    });

    it('should return null when level not found', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.getLevelConfig(99);

      expect(result).toBeNull();
    });
  });

  describe('getNextLevelConfig', () => {
    it('should return next level config', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValue({
        level: 3,
        title: 'Flor',
        minXP: 250,
        icon: '🌸',
      });

      const result = await repository.getNextLevelConfig(2);

      expect(result).toEqual({
        level: 3,
        title: 'Flor',
        minXP: 250,
        icon: '🌸',
      });
    });
  });

  describe('awardBadge', () => {
    it('should award badge and return true when newly awarded', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue({
        id: 'badge-id',
        code: 'FIRST_LESSON',
        name: 'Primera Lección',
        xpReward: 10,
      });

      (prisma.userGamification.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          userId: 'user-123',
          id: 'gamification-id',
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        })
        .mockResolvedValueOnce({
          userId: 'user-123',
          id: 'gamification-id',
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        })
        .mockResolvedValueOnce({
          userId: 'user-123',
          id: 'gamification-id',
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          badges: [],
        });

      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});
      (prisma.userGamification.update as jest.Mock).mockResolvedValue({});

      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const result = await repository.awardBadge('user-123', 'FIRST_LESSON');

      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });

    it('should return false when badge already owned', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue({
        id: 'badge-id',
        code: 'FIRST_LESSON',
        name: 'Primera Lección',
        xpReward: 10,
      });

      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-123',
        id: 'gamification-id',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        badges: [],
      });

      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-badge',
        userId: 'user-123',
        badgeId: 'badge-id',
      });

      const result = await repository.awardBadge('user-123', 'FIRST_LESSON');

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserBadges', () => {
    it('should return all badges for user', async () => {
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
        {
          badge: {
            code: 'FIRST_LESSON',
            name: 'Primera Lección',
            icon: '🌱',
            description: 'Completaste tu primera lección',
          },
          earnedAt: new Date('2024-01-01'),
        },
        {
          badge: {
            code: 'STREAK_3',
            name: 'Racha de 3',
            icon: '🔥',
            description: '3 días consecutivos',
          },
          earnedAt: new Date('2024-01-02'),
        },
      ]);

      const result = await repository.getUserBadges('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('FIRST_LESSON');
      expect(result[1].code).toBe('STREAK_3');
    });

    it('should return empty array when user has no badges', async () => {
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.getUserBadges('user-123');

      expect(result).toEqual([]);
    });
  });
});
