import { LEVEL_TITLES } from '../../domain/constants';
import type { ILevelConfigRepository } from '../../domain/ports/level-config.repository.port';

export class LevelService {
  constructor(private levelConfigRepo?: ILevelConfigRepository) {}

  async getLevel(level: number) {
    if (!this.levelConfigRepo) return null;
    return this.levelConfigRepo.findByLevel(level);
  }

  async calculateLevel(totalXP: number): Promise<number> {
    if (!this.levelConfigRepo) return 1;

    const levelConfigs = await this.levelConfigRepo.findAll();

    for (const config of levelConfigs) {
      if (totalXP >= config.minXP) {
        return config.level;
      }
    }

    return 1;
  }

  async getXPForNextLevel(currentLevel: number): Promise<number> {
    if (!this.levelConfigRepo) return 0;

    const nextLevelConfig = await this.levelConfigRepo.findByLevel(currentLevel + 1);
    if (!nextLevelConfig) {
      return 0;
    }

    const currentLevelConfig = await this.levelConfigRepo.findByLevel(currentLevel);
    if (!currentLevelConfig) {
      return nextLevelConfig.minXP;
    }

    return nextLevelConfig.minXP - currentLevelConfig.minXP;
  }

  getLevelTitle(level: number): string {
    return LEVEL_TITLES[level] ?? `Nivel ${level}`;
  }

  async getMinXPForLevel(level: number): Promise<number> {
    if (!this.levelConfigRepo) return 0;
    const config = await this.levelConfigRepo.findByLevel(level);
    return config?.minXP ?? 0;
  }

  async getLevelProgress(totalXP: number): Promise<{
    currentLevel: number;
    nextLevel: number | null;
    progressPercent: number;
    xpInCurrentLevel: number;
    xpNeededForNext: number;
  }> {
    const currentLevel = await this.calculateLevel(totalXP);
    const currentMinXP = await this.getMinXPForLevel(currentLevel);

    if (!this.levelConfigRepo) {
      return {
        currentLevel,
        nextLevel: null,
        progressPercent: 100,
        xpInCurrentLevel: 0,
        xpNeededForNext: 0,
      };
    }

    const nextLevelConfig = await this.levelConfigRepo.findByLevel(currentLevel + 1);

    if (!nextLevelConfig) {
      return {
        currentLevel,
        nextLevel: null,
        progressPercent: 100,
        xpInCurrentLevel: totalXP - currentMinXP,
        xpNeededForNext: 0,
      };
    }

    const nextMinXP = nextLevelConfig.minXP;
    const xpInCurrentLevel = totalXP - currentMinXP;
    const xpNeededForNext = nextMinXP - currentMinXP;
    const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));

    return {
      currentLevel,
      nextLevel: currentLevel + 1,
      progressPercent,
      xpInCurrentLevel,
      xpNeededForNext,
    };
  }
}
