/**
 * Gamification catalog — single source of truth for badge and level definitions.
 *
 * Both the database seed (`prisma/seed-gamification.ts`) and the runtime
 * fallbacks (`domain/constants.ts`) read from this module, so a badge code or
 * level title can never drift between the seed and the code that awards it.
 */

import type { BadgeRequirement } from '@/features/gamification/domain/entities/badge.types.js';

export interface GamificationBadgeSeed {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  rules: BadgeRequirement;
}

export interface GamificationLevelSeed {
  level: number;
  title: string;
  description: string;
  minXP: number;
  icon: string;
}

export const GAMIFICATION_BADGES: readonly GamificationBadgeSeed[] = [
  {
    code: 'FIRST_LESSON',
    name: 'Primera Lección',
    description: 'Completaste tu primera lección',
    icon: '🌱',
    xpReward: 10,
    rules: { type: 'LESSON_COUNT', value: 1 },
  },
  {
    code: 'LESSON_5',
    name: 'Lecturista',
    description: 'Completaste 5 lecciones',
    icon: '📚',
    xpReward: 50,
    rules: { type: 'LESSON_COUNT', value: 5 },
  },
  {
    code: 'PERFECT',
    name: 'Perfecto',
    description: 'Respondiste correctamente al primer intento',
    icon: '⭐',
    xpReward: 15,
    rules: { type: 'PERFECT_ATTEMPT', value: 1 },
  },
  {
    code: 'STREAK_3',
    name: 'Racha de 3',
    description: '3 días consecutivos de aprendizaje',
    icon: '🔥',
    xpReward: 25,
    rules: { type: 'STREAK', value: 3 },
  },
  {
    code: 'STREAK_7',
    name: 'Racha de 7',
    description: '7 días consecutivos de aprendizaje',
    icon: '🔥',
    xpReward: 50,
    rules: { type: 'STREAK', value: 7 },
  },
  {
    code: 'STREAK_30',
    name: 'Racha de 30',
    description: '30 días consecutivos de aprendizaje',
    icon: '🔥',
    xpReward: 150,
    rules: { type: 'STREAK', value: 30 },
  },
  {
    code: 'LEVEL_5',
    name: 'Maestro',
    description: 'Alcanzaste el nivel 5',
    icon: '🏆',
    xpReward: 100,
    rules: { type: 'LEVEL', value: 5 },
  },
];

export const GAMIFICATION_LEVELS: readonly GamificationLevelSeed[] = [
  {
    level: 1,
    title: 'Semilla',
    description: 'El comienzo de tu aventura',
    minXP: 0,
    icon: '🌱',
  },
  {
    level: 2,
    title: 'Brote',
    description: 'Está creciendo',
    minXP: 100,
    icon: '🌿',
  },
  {
    level: 3,
    title: 'Flor',
    description: '¡Hermoso!',
    minXP: 250,
    icon: '🌸',
  },
  {
    level: 4,
    title: 'Árbol',
    description: 'Muy fuerte',
    minXP: 500,
    icon: '🌳',
  },
  {
    level: 5,
    title: 'Bosque',
    description: '¡Imparable!',
    minXP: 1000,
    icon: '🌲',
  },
  {
    level: 6,
    title: 'Campeón',
    description: '¡LEYENDA!',
    minXP: 2000,
    icon: '🏆',
  },
];
