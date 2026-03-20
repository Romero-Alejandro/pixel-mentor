/**
 * Level Service - Calculate level progression and titles.
 *
 * This service encapsulates all level-related business logic including:
 * - Calculating level from total XP
 * - Getting XP thresholds for next level
 * - Generating level titles
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';

import { LEVEL_TITLES } from './constants';

export class LevelService {
  /**
   * Calculate the level based on total XP.
   * Uses the LevelConfig table to find the appropriate level.
   */
  async calculateLevel(totalXP: number): Promise<number> {
    // Get all level configs ordered by level descending
    const levelConfigs = await prisma.levelConfig.findMany({
      orderBy: { level: 'desc' },
    });

    // Find the highest level where minXP <= totalXP
    for (const config of levelConfigs) {
      if (totalXP >= config.minXP) {
        return config.level;
      }
    }

    // Default to level 1 if nothing matches (shouldn't happen with proper seed data)
    return 1;
  }

  /**
   * Get the XP required for the next level.
   * Returns 0 if already at max level.
   */
  async getXPForNextLevel(currentLevel: number): Promise<number> {
    const nextLevelConfig = await prisma.levelConfig.findUnique({
      where: { level: currentLevel + 1 },
    });

    if (!nextLevelConfig) {
      return 0; // Already at max level
    }

    const currentLevelConfig = await prisma.levelConfig.findUnique({
      where: { level: currentLevel },
    });

    if (!currentLevelConfig) {
      return nextLevelConfig.minXP;
    }

    return nextLevelConfig.minXP - currentLevelConfig.minXP;
  }

  /**
   * Get the title for a given level.
   * Falls back to a default if level not found.
   */
  getLevelTitle(level: number): string {
    return LEVEL_TITLES[level] ?? `Nivel ${level}`;
  }

  /**
   * Get the minimum XP required for a given level.
   */
  async getMinXPForLevel(level: number): Promise<number> {
    const config = await prisma.levelConfig.findUnique({
      where: { level },
    });

    return config?.minXP ?? 0;
  }

  /**
   * Get progress percentage towards next level.
   */
  async getLevelProgress(totalXP: number): Promise<{
    currentLevel: number;
    nextLevel: number | null;
    progressPercent: number;
    xpInCurrentLevel: number;
    xpNeededForNext: number;
  }> {
    const currentLevel = await this.calculateLevel(totalXP);
    const currentMinXP = await this.getMinXPForLevel(currentLevel);

    const nextLevelConfig = await prisma.levelConfig.findUnique({
      where: { level: currentLevel + 1 },
    });

    if (!nextLevelConfig) {
      // At max level
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
