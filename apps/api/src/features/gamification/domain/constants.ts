/**
 * Level configuration constants.
 *
 * Derived from the gamification catalog so titles and icons have exactly one
 * definition (the catalog is also what the database seed writes).
 */

import { GAMIFICATION_LEVELS } from '@/features/gamification/domain/gamification-catalog.js';

export const LEVEL_TITLES: Record<number, string> = GAMIFICATION_LEVELS.reduce(
  (acc, level) => {
    acc[level.level] = level.title;
    return acc;
  },
  {} as Record<number, string>,
);

export const LEVEL_ICONS: Record<number, string> = GAMIFICATION_LEVELS.reduce(
  (acc, level) => {
    acc[level.level] = level.icon;
    return acc;
  },
  {} as Record<number, string>,
);
