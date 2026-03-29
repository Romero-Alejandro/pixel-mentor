/**
 * Comprehensive unit tests for PrismaBadgeRepository.
 *
 * Tests cover all methods and edge cases:
 * - findAll: active badges, data mapping, ordering
 * - findByCode: found/not found, data mapping
 * - awardBadge: badge not found, user gamification creation, already awarded, tx handling
 * - getUserBadges: with/without badges, data mapping, ordering
 * - hasBadge: true/false scenarios, badge existence
 */

import { PrismaBadgeRepository } from '../prisma-badge.repository';

// Mock the prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    badge: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userBadge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    userGamification: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaBadgeRepository', () => {
  let repository: PrismaBadgeRepository;

  beforeEach(() => {
    repository = new PrismaBadgeRepository();
    jest.resetAllMocks();
    // Mock $transaction to execute callback with the prisma mock
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => await fn(prisma));
  });

  describe('findAll', () => {
    it('should return all active badges', async () => {
      const mockBadges = [
        {
          id: '1',
          code: 'FIRST_LESSON',
          name: 'First Lesson',
          description: 'Complete your first lesson',
          icon: '🌱',
          xpReward: 10,
          isActive: true,
          rules: { lessonsCompleted: 1 },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          code: 'STREAK_3',
          name: '3-Day Streak',
          description: 'Maintain a 3-day streak',
          icon: '🔥',
          xpReward: 25,
          isActive: true,
          rules: { streakDays: 3 },
          createdAt: new Date('2024-01-02'),
        },
      ];

      (prisma.badge.findMany as jest.Mock).mockResolvedValue(mockBadges);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'FIRST_LESSON',
        name: 'First Lesson',
        description: 'Complete your first lesson',
        icon: '🌱',
        xpReward: 10,
        rules: { lessonsCompleted: 1 },
      });
      expect(result[1]).toEqual({
        code: 'STREAK_3',
        name: '3-Day Streak',
        description: 'Maintain a 3-day streak',
        icon: '🔥',
        xpReward: 25,
        rules: { streakDays: 3 },
      });

      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no active badges exist', async () => {
      (prisma.badge.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should correctly cast rules to Record<string, unknown>', async () => {
      (prisma.badge.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          code: 'COMPLEX',
          name: 'Complex',
          description: 'Complex rules',
          icon: '🎯',
          xpReward: 50,
          isActive: true,
          rules: { minScore: 100, achievements: ['a', 'b'], nested: { key: 'value' } },
          createdAt: new Date(),
        },
      ]);

      const result = await repository.findAll();

      expect(result[0].rules).toEqual({
        minScore: 100,
        achievements: ['a', 'b'],
        nested: { key: 'value' },
      });
      expect(typeof result[0].rules).toBe('object');
    });

    it('should order badges by createdAt ascending', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-01-02');

      (prisma.badge.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          code: 'OLDER',
          name: 'Older',
          description: '',
          icon: '',
          xpReward: 0,
          isActive: true,
          rules: {},
          createdAt: older,
        },
        {
          id: '2',
          code: 'NEWER',
          name: 'Newer',
          description: '',
          icon: '',
          xpReward: 0,
          isActive: true,
          rules: {},
          createdAt: newer,
        },
      ]);

      const result = await repository.findAll();

      expect(result[0].code).toBe('OLDER');
      expect(result[1].code).toBe('NEWER');
    });
  });

  describe('findByCode', () => {
    it('should return badge info when found', async () => {
      const mockBadge = {
        id: 'badge-1',
        code: 'FIRST_LESSON',
        name: 'First Lesson',
        icon: '🌱',
        xpReward: 10,
        description: 'Complete your first lesson',
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(mockBadge);

      const result = await repository.findByCode('FIRST_LESSON');

      expect(result).toEqual({
        code: 'FIRST_LESSON',
        name: 'First Lesson',
        icon: '🌱',
        xpReward: 10,
      });

      expect(prisma.badge.findUnique).toHaveBeenCalledWith({
        where: { code: 'FIRST_LESSON' },
      });
    });

    it('should return null when badge not found', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByCode('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should return only required fields, excluding description', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        code: 'TEST',
        name: 'Test',
        icon: '✅',
        xpReward: 5,
        description: 'Should not be included',
      });

      const result = await repository.findByCode('TEST');

      expect(result).toEqual({
        code: 'TEST',
        name: 'Test',
        icon: '✅',
        xpReward: 5,
      });
      expect(result).not.toHaveProperty('description');
    });
  });

  describe('awardBadge', () => {
    it('should award badge and return true when newly awarded with existing gamification', async () => {
      const badge = {
        id: 'badge-id',
        code: 'FIRST_LESSON',
        name: 'Primera Lección',
        xpReward: 10,
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);

      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
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

      const result = await repository.awardBadge('user-123', 'FIRST_LESSON');

      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });

    it('should award badge and return true when creating new user gamification', async () => {
      const badge = {
        id: 'badge-1',
        code: 'FIRST_LESSON',
        name: 'First Lesson',
        xpReward: 10,
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userGamification.create as jest.Mock).mockResolvedValue({
        id: 'new-gamification-id',
        userId: 'user-456',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      });
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      const result = await repository.awardBadge('user-456', 'FIRST_LESSON');

      expect(result).toBe(true);
      expect(prisma.userGamification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-456',
          totalXP: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
        },
      });
      expect(prisma.userBadge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-456',
            badgeId: 'badge-1',
            userGamificationId: 'new-gamification-id',
          }),
        }),
      );
    });

    it('should return false when badge not found', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.awardBadge('user-123', 'NONEXISTENT');

      expect(result).toBe(false);
      expect(prisma.userGamification.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return false when badge already awarded', async () => {
      const badge = {
        id: 'badge-1',
        code: 'FIRST_LESSON',
        name: 'Primera Lección',
        xpReward: 10,
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-badge',
        userId: 'user-123',
        badgeId: 'badge-1',
      });

      const result = await repository.awardBadge('user-123', 'FIRST_LESSON');

      expect(result).toBe(false);
      expect(prisma.userGamification.findUnique).not.toHaveBeenCalled();
      expect(prisma.userGamification.create).not.toHaveBeenCalled();
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it('should use transaction to ensure atomicity', async () => {
      const badge = { id: 'badge-1', code: 'TEST', name: 'Test', xpReward: 5 };
      const userGamification = {
        id: 'gamif-1',
        userId: 'user-1',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue(userGamification);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      await repository.awardBadge('user-1', 'TEST');

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));

      // Verify that the transaction executes the operations
      const txCallback = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(typeof txCallback).toBe('function');
    });

    it('should not create user badge if already exists within transaction', async () => {
      const badge = { id: 'badge-1', code: 'EXISTING', name: 'Existing', xpReward: 5 };
      const existingBadge = { id: 'ub-1', userId: 'user-1', badgeId: 'badge-1' };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(existingBadge);

      const result = await repository.awardBadge('user-1', 'EXISTING');

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it('should correctly assign userGamificationId when creating new badge entry', async () => {
      const badge = { id: 'badge-x', code: 'CODE', name: 'Code', xpReward: 0 };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        id: 'gamif-id',
        userId: 'user',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      });
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      const result = await repository.awardBadge('user', 'CODE');

      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalledWith({
        data: {
          userId: 'user',
          badgeId: 'badge-x',
          userGamificationId: 'gamif-id',
        },
      });
    });

    it('should properly use userId and badgeCode parameters', async () => {
      const badge = { id: 'b-999', code: 'SPECIAL', name: 'Special Badge', xpReward: 100 };
      const userGamification = {
        id: 'g-999',
        userId: 'specific-user',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue(userGamification);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      await repository.awardBadge('specific-user', 'SPECIAL');

      expect(prisma.badge.findUnique).toHaveBeenCalledWith({ where: { code: 'SPECIAL' } });
      // The userId used in create should match input
      const createCall = (prisma.userBadge.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.userId).toBe('specific-user');
      expect(createCall.data.badgeId).toBe('b-999');
      expect(createCall.data.userGamificationId).toBe('g-999');
    });
  });

  describe('getUserBadges', () => {
    it('should return user badges with correct mapping', async () => {
      const now = new Date('2024-03-15T10:00:00Z');
      const mockUserBadges = [
        {
          id: 'ub-1',
          userId: 'user-123',
          badgeId: 'badge-1',
          earnedAt: now,
          badge: {
            code: 'FIRST_LESSON',
            name: 'First Lesson',
            icon: '🌱',
            description: 'Complete your first lesson',
          },
        },
        {
          id: 'ub-2',
          userId: 'user-123',
          badgeId: 'badge-2',
          earnedAt: new Date('2024-03-16T10:00:00Z'),
          badge: {
            code: 'STREAK_3',
            name: '3-Day Streak',
            icon: '🔥',
            description: '3 days in a row',
          },
        },
      ];

      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue(mockUserBadges);

      const result = await repository.getUserBadges('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'FIRST_LESSON',
        name: 'First Lesson',
        icon: '🌱',
        description: 'Complete your first lesson',
        earnedAt: now,
      });
      expect(result[1].code).toBe('STREAK_3');
    });

    it('should return empty array when user has no badges', async () => {
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.getUserBadges('user-123');

      expect(result).toEqual([]);
    });

    it('should include earnedAt timestamp', async () => {
      const earnedAt = new Date('2024-01-15T14:30:00Z');
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ub-1',
          userId: 'user-123',
          badgeId: 'b1',
          earnedAt,
          badge: {
            code: 'CODE',
            name: 'Name',
            icon: '⭐',
            description: 'Desc',
          },
        },
      ]);

      const result = await repository.getUserBadges('user-123');

      expect(result[0].earnedAt).toBe(earnedAt);
      expect(result[0].earnedAt).toBeInstanceOf(Date);
    });

    it('should order badges by earnedAt descending (most recent first)', async () => {
      const older = new Date('2024-01-01');
      const newer = new Date('2024-01-02');

      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ub-1',
          userId: 'user-123',
          badgeId: 'b1',
          earnedAt: newer,
          badge: { code: 'NEW', name: 'New', icon: '🆕', description: '' },
        },
        {
          id: 'ub-2',
          userId: 'user-123',
          badgeId: 'b2',
          earnedAt: older,
          badge: { code: 'OLD', name: 'Old', icon: '🕰️', description: '' },
        },
      ]);

      const result = await repository.getUserBadges('user-123');

      expect(result[0].code).toBe('NEW');
      expect(result[1].code).toBe('OLD');
    });

    it('should query with correct parameters including include', async () => {
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([]);

      await repository.getUserBadges('user-999');

      expect(prisma.userBadge.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-999' },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      });
    });
  });

  describe('hasBadge', () => {
    it('should return true when user has the badge', async () => {
      const badge = { id: 'badge-1', code: 'FIRST_LESSON', name: '', icon: '', xpReward: 0 };
      const userBadge = { id: 'ub-1', userId: 'user-123', badgeId: 'badge-1' };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(userBadge);

      const result = await repository.hasBadge('user-123', 'FIRST_LESSON');

      expect(result).toBe(true);
    });

    it('should return false when user does not have the badge', async () => {
      const badge = { id: 'badge-1', code: 'FIRST_LESSON', name: '', icon: '', xpReward: 0 };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.hasBadge('user-123', 'FIRST_LESSON');

      expect(result).toBe(false);
    });

    it('should return false when badge code does not exist', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.hasBadge('user-123', 'NONEXISTENT');

      expect(result).toBe(false);
      expect(prisma.userBadge.findUnique).not.toHaveBeenCalled();
    });

    it('should query with correct composite key', async () => {
      const badge = { id: 'b-123', code: 'TEST', name: '', icon: '', xpReward: 0 };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);

      await repository.hasBadge('user-abc', 'TEST');

      expect(prisma.userBadge.findUnique).toHaveBeenCalledWith({
        where: {
          userId_badgeId: {
            userId: 'user-abc',
            badgeId: 'b-123',
          },
        },
      });
    });

    it('should not leak badge details when checking existence', async () => {
      const badge = { id: 'b-1', code: 'CODE', name: 'Name', icon: 'Icon', xpReward: 10 };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue({ id: 'ub-1' });

      const result = await repository.hasBadge('user-1', 'CODE');

      expect(result).toBe(true);
      // Only boolean is returned, no badge data
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full badge lifecycle: award then check then get', async () => {
      const badge = { id: 'b1', code: 'LIFECYCLE', name: 'Lifecycle', icon: '🔄', xpReward: 15 };

      // Setup: award badge
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        id: 'g1',
        userId: 'user-1',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      });
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      const awardResult = await repository.awardBadge('user-1', 'LIFECYCLE');
      expect(awardResult).toBe(true);

      // Clear mocks for next phase
      jest.clearAllMocks();

      // Check hasBadge returns true
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue({
        id: 'ub-1',
        userId: 'user-1',
        badgeId: 'b1',
      });

      const hasResult = await repository.hasBadge('user-1', 'LIFECYCLE');
      expect(hasResult).toBe(true);

      // Get user badges
      jest.clearAllMocks();
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ub-1',
          userId: 'user-1',
          badgeId: 'b1',
          earnedAt: new Date(),
          badge: { code: 'LIFECYCLE', name: 'Lifecycle', icon: '🔄', description: 'Test' },
        },
      ]);

      const badges = await repository.getUserBadges('user-1');
      expect(badges).toHaveLength(1);
      expect(badges[0].code).toBe('LIFECYCLE');
    });

    it('should not double-award badge even with concurrent-like calls', async () => {
      const badge = { id: 'b1', code: 'UNIQUE', name: 'Unique', icon: '🎯', xpReward: 10 };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userBadge.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'ub-2', userId: 'user-1', badgeId: 'b1' }); // Second call finds it
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        id: 'g1',
        userId: 'user-1',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      });
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      const result1 = await repository.awardBadge('user-1', 'UNIQUE');
      const result2 = await repository.awardBadge('user-1', 'UNIQUE');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(prisma.userBadge.create).toHaveBeenCalledTimes(1);
    });

    it('should handle finder methods correctly when database returns null for badge', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(null);

      const findByCodeResult = await repository.findByCode('UNKNOWN');
      expect(findByCodeResult).toBeNull();

      const hasBadgeResult = await repository.hasBadge('user-1', 'UNKNOWN');
      expect(hasBadgeResult).toBe(false);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty rules object', async () => {
      (prisma.badge.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          code: 'EMPTY',
          name: 'Empty',
          description: '',
          icon: '—',
          xpReward: 0,
          isActive: true,
          rules: {},
          createdAt: new Date(),
        },
      ]);

      const result = await repository.findAll();
      expect(result[0].rules).toEqual({});
    });

    it('should handle all badge properties being non-null (typical case)', async () => {
      const fullBadge = {
        id: '1',
        code: 'FULL',
        name: 'Full Badge',
        description: 'A complete badge',
        icon: '🏆',
        xpReward: 100,
        isActive: true,
        rules: { condition: 'complete_all' },
        createdAt: new Date(),
      };

      (prisma.badge.findMany as jest.Mock).mockResolvedValue([fullBadge]);

      const result = await repository.findAll();

      expect(result[0]).toEqual({
        code: 'FULL',
        name: 'Full Badge',
        description: 'A complete badge',
        icon: '🏆',
        xpReward: 100,
        rules: { condition: 'complete_all' },
      });
    });

    it('should handle special characters in badge code', async () => {
      (prisma.badge.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        code: 'UNDERSCORE_TEST',
        name: 'Underscore Test',
        icon: '🔤',
        xpReward: 5,
      });

      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue({
        id: 'g1',
        userId: 'user-1',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      });

      const result = await repository.awardBadge('user-1', 'UNDERSCORE_TEST');

      expect(result).toBe(true);
    });

    it('should handle large xpReward values', async () => {
      const badge = { id: '1', code: 'BIG_XP', name: 'Big XP', xpReward: 10000 };

      (prisma.badge.findMany as jest.Mock).mockResolvedValue([badge]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].xpReward).toBe(10000);
    });

    it('should throw when badge relation is missing (defensive)', async () => {
      (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ub-1',
          userId: 'user-1',
          badgeId: 'missing-badge',
          earnedAt: new Date(),
          badge: null,
        },
      ]);

      await expect(repository.getUserBadges('user-1')).rejects.toThrow();
    });

    it('should handle findMany with multiple badges efficiently', async () => {
      const manyBadges = Array.from({ length: 100 }, (_, i) => ({
        id: `b${i}`,
        code: `BADGE_${i}`,
        name: `Badge ${i}`,
        description: `Description ${i}`,
        icon: '🎖️',
        xpReward: i * 10,
        isActive: true,
        rules: { index: i },
        createdAt: new Date(Date.now() + i),
      }));

      (prisma.badge.findMany as jest.Mock).mockResolvedValue(manyBadges);

      const result = await repository.findAll();

      expect(result).toHaveLength(100);
      expect(result[0].code).toBe('BADGE_0');
      expect(result[99].code).toBe('BADGE_99');
      expect(result[99].xpReward).toBe(990);
    });
  });

  describe('Data consistency', () => {
    it('should always include required fields in findAll output', async () => {
      (prisma.badge.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          code: 'REQ',
          name: 'Required',
          description: 'Test',
          icon: '✅',
          xpReward: 1,
          isActive: true,
          rules: null,
          createdAt: new Date(),
        },
      ]);

      const result = await repository.findAll();

      const badge = result[0];
      expect(badge).toHaveProperty('code');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('description');
      expect(badge).toHaveProperty('icon');
      expect(badge).toHaveProperty('xpReward');
      expect(badge).toHaveProperty('rules');
      expect(typeof badge.code).toBe('string');
      expect(typeof badge.name).toBe('string');
      expect(typeof badge.xpReward).toBe('number');
    });

    it('should consistently map database fields to output DTOs', async () => {
      const dbBadge = {
        id: 'db-1',
        code: 'MAPPED',
        name: 'Mapped Name',
        description: 'Mapped description',
        icon: '🗺️',
        xpReward: 42,
        isActive: true,
        rules: { test: true },
        createdAt: new Date(),
      };

      (prisma.badge.findMany as jest.Mock).mockResolvedValue([dbBadge]);

      const result = await repository.findAll();

      expect(result[0].code).toBe(dbBadge.code);
      expect(result[0].name).toBe(dbBadge.name);
      expect(result[0].description).toBe(dbBadge.description);
      expect(result[0].icon).toBe(dbBadge.icon);
      expect(result[0].xpReward).toBe(dbBadge.xpReward);
    });
  });

  describe('Prisma mock verification', () => {
    it('should not call extra Prisma queries beyond what is needed', async () => {
      const badge = { id: '1', code: 'MINIMAL', name: 'Minimal', xpReward: 0 };
      const userGamification = {
        id: 'g1',
        userId: 'u1',
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
      };

      (prisma.badge.findUnique as jest.Mock).mockResolvedValue(badge);
      (prisma.userGamification.findUnique as jest.Mock).mockResolvedValue(userGamification);
      (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userBadge.create as jest.Mock).mockResolvedValue({});

      await repository.awardBadge('u1', 'MINIMAL');

      expect(prisma.badge.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.userGamification.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.userBadge.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.userBadge.create).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should reset mocks between tests via beforeEach', () => {
      // This is more of a sanity check - the beforeEach should clear mocks
      (prisma.badge.findMany as jest.Mock).mockResolvedValue([]);
      expect(prisma.badge.findMany).toHaveBeenCalledTimes(0);
    });
  });
});
