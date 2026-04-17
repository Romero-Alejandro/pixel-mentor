/**
 * Centralized Gamification Configuration
 *
 * All XP values, thresholds, and constants used across the gamification
 * system should be defined here to avoid hardcoded magic numbers.
 */

export const GamificationConfig = {
  /** Base XP awarded for completing a lesson */
  BASE_LESSON_XP: 50,

  /** XP bonus for perfect first-attempt accuracy */
  PERFECT_FIRST_ATTEMPT_BONUS: 20,

  /** XP tiers based on accuracy percentage */
  XP_TIERS: {
    PERFECT: { minAccuracy: 100, xp: 50 },
    HIGH: { minAccuracy: 80, xp: 50 },
    MEDIUM: { minAccuracy: 50, xp: 30 },
    LOW: { minAccuracy: 0, xp: 10 },
  } as const,

  /** Streak bonus XP for 5+ day streaks */
  STREAK_5_BONUS_XP: 10,

  /** Streak bonus XP for 30+ day streaks */
  STREAK_30_BONUS_XP: 25,

  /** XP multiplier thresholds */
  MULTIPLIER: {
    HIGH: 2.0,
    MEDIUM: 1.5,
    LOW: 1.0,
  },
} as const;

export type GamificationConfigType = typeof GamificationConfig;
