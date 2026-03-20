/**
 * Unit tests for LevelService.
 */

import { LevelService } from '../level.service';

// Mock the prisma client - define mocks inside the factory
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    levelConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from '@/infrastructure/adapters/database/client';

describe('LevelService', () => {
  let levelService: LevelService;

  beforeEach(() => {
    levelService = new LevelService();
    jest.clearAllMocks();
  });

  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', async () => {
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' },
        { level: 5, title: 'Bosque', minXP: 1000, icon: '🌲' },
        { level: 4, title: 'Árbol', minXP: 500, icon: '🌳' },
        { level: 3, title: 'Flor', minXP: 250, icon: '🌸' },
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const level = await levelService.calculateLevel(0);
      expect(level).toBe(1);
    });

    it('should return level 2 for XP between 100 and 249', async () => {
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' },
        { level: 5, title: 'Bosque', minXP: 1000, icon: '🌲' },
        { level: 4, title: 'Árbol', minXP: 500, icon: '🌳' },
        { level: 3, title: 'Flor', minXP: 250, icon: '🌸' },
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const level = await levelService.calculateLevel(150);
      expect(level).toBe(2);
    });

    it('should return level 3 for 250 XP', async () => {
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' },
        { level: 5, title: 'Bosque', minXP: 1000, icon: '🌲' },
        { level: 4, title: 'Árbol', minXP: 500, icon: '🌳' },
        { level: 3, title: 'Flor', minXP: 250, icon: '🌸' },
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const level = await levelService.calculateLevel(250);
      expect(level).toBe(3);
    });

    it('should return level 6 for 2000+ XP', async () => {
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' },
        { level: 5, title: 'Bosque', minXP: 1000, icon: '🌲' },
        { level: 4, title: 'Árbol', minXP: 500, icon: '🌳' },
        { level: 3, title: 'Flor', minXP: 250, icon: '🌸' },
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      const level = await levelService.calculateLevel(2500);
      expect(level).toBe(6);
    });
  });

  describe('getXPForNextLevel', () => {
    it('should return 100 XP needed for level 2 when at level 1', async () => {
      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' })
        .mockResolvedValueOnce({ level: 1, title: 'Semilla', minXP: 0, icon: '🌱' });

      const xpNeeded = await levelService.getXPForNextLevel(1);
      expect(xpNeeded).toBe(100);
    });

    it('should return 150 XP needed for level 3 when at level 2', async () => {
      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 3, title: 'Flor', minXP: 250, icon: '🌸' })
        .mockResolvedValueOnce({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' });

      const xpNeeded = await levelService.getXPForNextLevel(2);
      expect(xpNeeded).toBe(150);
    });

    it('should return 0 when at max level', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const xpNeeded = await levelService.getXPForNextLevel(6);
      expect(xpNeeded).toBe(0);
    });
  });

  describe('getLevelTitle', () => {
    it('should return correct title for level 1', () => {
      expect(levelService.getLevelTitle(1)).toBe('Semilla');
    });

    it('should return correct title for level 2', () => {
      expect(levelService.getLevelTitle(2)).toBe('Brote');
    });

    it('should return correct title for level 3', () => {
      expect(levelService.getLevelTitle(3)).toBe('Flor');
    });

    it('should return correct title for level 4', () => {
      expect(levelService.getLevelTitle(4)).toBe('Árbol');
    });

    it('should return correct title for level 5', () => {
      expect(levelService.getLevelTitle(5)).toBe('Bosque');
    });

    it('should return correct title for level 6', () => {
      expect(levelService.getLevelTitle(6)).toBe('Campeón');
    });

    it('should return fallback for unknown level', () => {
      expect(levelService.getLevelTitle(99)).toBe('Nivel 99');
    });
  });

  describe('getMinXPForLevel', () => {
    it('should return min XP for level 1', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValueOnce({
        level: 1,
        title: 'Semilla',
        minXP: 0,
        icon: '🌱',
      });

      const minXP = await levelService.getMinXPForLevel(1);
      expect(minXP).toBe(0);
    });

    it('should return min XP for level 5', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValueOnce({
        level: 5,
        title: 'Bosque',
        minXP: 1000,
        icon: '🌲',
      });

      const minXP = await levelService.getMinXPForLevel(5);
      expect(minXP).toBe(1000);
    });

    it('should return 0 for unknown level', async () => {
      (prisma.levelConfig.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const minXP = await levelService.getMinXPForLevel(99);
      expect(minXP).toBe(0);
    });
  });

  describe('getLevelProgress', () => {
    it('should return correct progress for level 1 at 50 XP', async () => {
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' },
        { level: 5, title: 'Bosque', minXP: 1000, icon: '🌲' },
        { level: 4, title: 'Árbol', minXP: 500, icon: '🌳' },
        { level: 3, title: 'Flor', minXP: 250, icon: '🌸' },
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 1, title: 'Semilla', minXP: 0, icon: '🌱' })
        .mockResolvedValueOnce({ level: 2, title: 'Brote', minXP: 100, icon: '🌿' });

      const progress = await levelService.getLevelProgress(50);

      expect(progress.currentLevel).toBe(1);
      expect(progress.nextLevel).toBe(2);
      expect(progress.xpInCurrentLevel).toBe(50);
      expect(progress.xpNeededForNext).toBe(100);
      expect(progress.progressPercent).toBe(50);
    });

    it('should return 100% progress for max level', async () => {
      (prisma.levelConfig.findMany as jest.Mock).mockResolvedValue([
        { level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' },
        { level: 5, title: 'Bosque', minXP: 1000, icon: '🌲' },
        { level: 4, title: 'Árbol', minXP: 500, icon: '🌳' },
        { level: 3, title: 'Flor', minXP: 250, icon: '🌸' },
        { level: 2, title: 'Brote', minXP: 100, icon: '🌿' },
        { level: 1, title: 'Semilla', minXP: 0, icon: '🌱' },
      ]);

      (prisma.levelConfig.findUnique as jest.Mock)
        .mockResolvedValueOnce({ level: 6, title: 'Campeón', minXP: 2000, icon: '🏆' })
        .mockResolvedValueOnce(null);

      const progress = await levelService.getLevelProgress(5000);

      expect(progress.currentLevel).toBe(6);
      expect(progress.nextLevel).toBeNull();
      expect(progress.progressPercent).toBe(100);
    });
  });
});
