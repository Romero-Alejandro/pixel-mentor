/**
 * LevelService — derives a user's level from XP.
 *
 * `level` is never stored. It is computed from `LevelConfig.minXP` for the
 * current `totalXP`, falling back to the seed catalog when the table is empty
 * (which is a real scenario: a fresh database has no level rows).
 *
 * Every method loads the level table once; there is no async constructor and
 * no background initialization.
 */

import { GAMIFICATION_LEVELS } from '@/features/gamification/domain/gamification-catalog.js';
import { LEVEL_TITLES } from '@/features/gamification/domain/constants.js';
import type { ILevelConfigRepository } from '@/features/gamification/domain/ports/level-config.repository.port.js';

export interface ResolvedLevel {
  level: number;
  title: string;
  icon: string;
}

export interface LevelDescription extends ResolvedLevel {
  minXP: number;
  nextLevel: number | null;
  nextMinXP: number | null;
  xpInCurrentLevel: number;
  /** XP span of the current level (nextMinXP - minXP); 0 at max level. */
  xpToNextLevel: number;
  progressPercent: number;
}

interface LevelDefinition {
  level: number;
  title: string;
  minXP: number;
  icon: string;
}

const CATALOG_LEVELS: readonly LevelDefinition[] = GAMIFICATION_LEVELS.map((level) => ({
  level: level.level,
  title: level.title,
  minXP: level.minXP,
  icon: level.icon,
}));

export class LevelService {
  constructor(private readonly levelConfigRepo?: ILevelConfigRepository) {}

  private async loadLevels(): Promise<readonly LevelDefinition[]> {
    if (!this.levelConfigRepo) {
      return CATALOG_LEVELS;
    }

    const configs = await this.levelConfigRepo.findAll();
    // An empty table means "not seeded yet": the catalog is authoritative.
    return configs.length > 0 ? configs : CATALOG_LEVELS;
  }

  private static sortByMinXP(levels: readonly LevelDefinition[]): LevelDefinition[] {
    return [...levels].sort((a, b) => a.minXP - b.minXP);
  }

  /**
   * Full level description for a given XP total.
   * One level-table read per call.
   */
  async describe(totalXP: number): Promise<LevelDescription> {
    const levels = LevelService.sortByMinXP(await this.loadLevels());
    const safeXP = Math.max(0, totalXP);

    let current = levels[0];
    for (const level of levels) {
      if (safeXP >= level.minXP) {
        current = level;
      }
    }

    const next = levels.find((level) => level.level === current.level + 1) ?? null;
    const xpInCurrentLevel = safeXP - current.minXP;
    const xpToNextLevel = next ? next.minXP - current.minXP : 0;
    const progressPercent =
      next && xpToNextLevel > 0
        ? Math.min(100, Math.round((xpInCurrentLevel / xpToNextLevel) * 100))
        : 100;

    return {
      level: current.level,
      title: current.title,
      icon: current.icon,
      minXP: current.minXP,
      nextLevel: next?.level ?? null,
      nextMinXP: next?.minXP ?? null,
      xpInCurrentLevel,
      xpToNextLevel,
      progressPercent,
    };
  }

  async resolve(totalXP: number): Promise<ResolvedLevel> {
    const description = await this.describe(totalXP);
    return {
      level: description.level,
      title: description.title,
      icon: description.icon,
    };
  }

  async calculateLevel(totalXP: number): Promise<number> {
    return (await this.describe(totalXP)).level;
  }

  async getLevel(level: number) {
    if (!this.levelConfigRepo) return null;
    return this.levelConfigRepo.findByLevel(level);
  }

  async getXPForNextLevel(currentLevel: number): Promise<number> {
    const levels = LevelService.sortByMinXP(await this.loadLevels());
    const current = levels.find((level) => level.level === currentLevel);
    const next = levels.find((level) => level.level === currentLevel + 1);

    if (!next) return 0;
    if (!current) return next.minXP;

    return next.minXP - current.minXP;
  }

  getLevelTitle(level: number): string {
    return LEVEL_TITLES[level] ?? `Nivel ${level}`;
  }

  async getMinXPForLevel(level: number): Promise<number> {
    const levels = await this.loadLevels();
    return levels.find((definition) => definition.level === level)?.minXP ?? 0;
  }

  async getLevelProgress(totalXP: number): Promise<{
    currentLevel: number;
    nextLevel: number | null;
    progressPercent: number;
    xpInCurrentLevel: number;
    xpNeededForNext: number;
  }> {
    const description = await this.describe(totalXP);

    return {
      currentLevel: description.level,
      nextLevel: description.nextLevel,
      progressPercent: description.progressPercent,
      xpInCurrentLevel: description.xpInCurrentLevel,
      xpNeededForNext: description.xpToNextLevel,
    };
  }
}
