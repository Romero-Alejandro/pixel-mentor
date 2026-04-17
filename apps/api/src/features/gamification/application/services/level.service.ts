import { LEVEL_TITLES } from '../../domain/constants';
import type { ILevelConfigRepository } from '../../domain/ports/level-config.repository.port';

const DEFAULT_MAX_LEVEL = 6;

export class LevelService {
  private maxLevel: number = DEFAULT_MAX_LEVEL;

  constructor(private levelConfigRepo?: ILevelConfigRepository) {
    if (levelConfigRepo) {
      this.initializeMaxLevel();
    }
  }

  private async initializeMaxLevel(): Promise<void> {
    if (!this.levelConfigRepo) return;
    const configs = await this.levelConfigRepo.findAll();
    if (configs.length > 0) {
      const max = Math.max(...configs.map((c) => c.level));
      if (max > 0) this.maxLevel = max;
    }
  }

  getMaxLevel(): number {
    return this.maxLevel;
  }

  async getLevel(level: number) {
    if (!this.levelConfigRepo) return null;
    return this.levelConfigRepo.findByLevel(level);
  }

  async calculateLevel(totalXP: number): Promise<number> {
    let maxLevel = this.maxLevel;

    if (this.levelConfigRepo) {
      const levelConfigs = await this.levelConfigRepo.findAll();
      if (levelConfigs.length > 0) {
        maxLevel = Math.max(...levelConfigs.map((c) => c.level), DEFAULT_MAX_LEVEL);
        this.maxLevel = maxLevel;
      }
    }

    if (!this.levelConfigRepo) {
      const fallbackLevels: Record<number, number> = {
        1: 0,
        2: 100,
        3: 250,
        4: 500,
        5: 1000,
        6: 2000,
      };
      for (const [level, minXP] of Object.entries(fallbackLevels).sort(
        (a, b) => Number(b[1]) - Number(a[1]),
      )) {
        if (totalXP >= Number(minXP)) {
          return Math.min(Number(level), maxLevel);
        }
      }
      return 1;
    }

    const levelConfigs = await this.levelConfigRepo.findAll();
    let calculatedLevel = 1;

    for (const config of levelConfigs) {
      if (totalXP >= config.minXP) {
        calculatedLevel = config.level;
      }
    }

    return Math.min(calculatedLevel, maxLevel);
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
