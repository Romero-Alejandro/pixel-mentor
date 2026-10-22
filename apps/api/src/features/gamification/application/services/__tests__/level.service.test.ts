import { LevelService } from '@/features/gamification/application/services/level.service.js';
import type { ILevelConfigRepository } from '@/features/gamification/domain/ports/level-config.repository.port.js';

function createRepo(configs: Array<{ level: number; title: string; minXP: number; icon: string }>) {
  return {
    findAll: jest.fn().mockResolvedValue(configs),
    findByLevel: jest.fn(),
  } as unknown as ILevelConfigRepository;
}

describe('LevelService', () => {
  describe('with an empty level table', () => {
    const service = new LevelService(createRepo([]));

    it('falls back to the seed catalog instead of pinning everyone to level 1', async () => {
      await expect(service.calculateLevel(0)).resolves.toBe(1);
      await expect(service.calculateLevel(99)).resolves.toBe(1);
      await expect(service.calculateLevel(100)).resolves.toBe(2);
      await expect(service.calculateLevel(250)).resolves.toBe(3);
      await expect(service.calculateLevel(2000)).resolves.toBe(6);
      await expect(service.calculateLevel(999_999)).resolves.toBe(6);
    });

    it('works without a repository at all', async () => {
      const serviceWithoutRepo = new LevelService();
      await expect(serviceWithoutRepo.calculateLevel(500)).resolves.toBe(4);
    });
  });

  describe('with database configs', () => {
    const service = new LevelService(
      createRepo([
        { level: 1, title: 'A', minXP: 0, icon: 'a' },
        { level: 2, title: 'B', minXP: 1000, icon: 'b' },
      ]),
    );

    it('uses the configured thresholds', async () => {
      await expect(service.calculateLevel(999)).resolves.toBe(1);
      await expect(service.calculateLevel(1000)).resolves.toBe(2);
      await expect(service.getXPForNextLevel(1)).resolves.toBe(1000);
      await expect(service.getXPForNextLevel(2)).resolves.toBe(0);
    });
  });

  describe('describe()', () => {
    const service = new LevelService(createRepo([]));

    it('reports progress inside the current level', async () => {
      const description = await service.describe(50);

      expect(description).toMatchObject({
        level: 1,
        title: 'Semilla',
        minXP: 0,
        nextLevel: 2,
        nextMinXP: 100,
        xpInCurrentLevel: 50,
        xpToNextLevel: 100,
        progressPercent: 50,
      });
    });

    it('reports 100% at max level', async () => {
      const description = await service.describe(5000);

      expect(description).toMatchObject({
        level: 6,
        nextLevel: null,
        xpToNextLevel: 0,
        progressPercent: 100,
      });
    });

    it('never returns a negative XP balance', async () => {
      const description = await service.describe(-100);
      expect(description).toMatchObject({ level: 1, xpInCurrentLevel: 0 });
    });
  });
});
