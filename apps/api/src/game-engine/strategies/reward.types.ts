/**
 * Reward Types - Core type definitions for the reward strategy system.
 *
 * These types define the contract between strategies and the game engine.
 */

import type {
  LessonCompletedPayload,
  ActivityAttemptPayload,
  DailyLoginPayload,
} from '@/events/game-events';

/**
 * Event types that can trigger reward strategies.
 */
export type GameEventPayload = LessonCompletedPayload | ActivityAttemptPayload | DailyLoginPayload;

/**
 * Supported reward types.
 */
export type RewardType = 'XP' | 'BADGE' | 'STREAK_BONUS';

/**
 * Context passed to strategies to evaluate and generate rewards.
 */
export interface RewardContext {
  /** The user to evaluate/generate rewards for */
  userId: string;
  /** The event that triggered this evaluation */
  event: {
    type: string;
    payload: GameEventPayload;
  };
  /** Additional metadata for evaluation */
  metadata: {
    /** User's current gamification profile */
    profile?: {
      level: number;
      totalXP: number;
      streak: number;
      longestStreak: number;
      totalBadges: number;
      completedLessons: number;
    };
    /** User's already earned badge codes */
    earnedBadgeCodes?: string[];
    /** Additional event-specific data */
    [key: string]: unknown;
  };
}

/**
 * A single reward to be applied.
 */
export interface Reward {
  /** Type of reward */
  type: RewardType;
  /** Amount of XP (for XP and STREAK_BONUS types, optional for BADGE) */
  amount?: number;
  /** Badge code to award (for BADGE type) */
  badgeCode?: string;
  /** Badge name to award (for BADGE type) */
  badgeName?: string;
  /** Badge icon to award (for BADGE type) */
  badgeIcon?: string;
  /** Description of how the reward was calculated */
  description: string;
}

/**
 * Strategy configuration for factory creation.
 */
export interface StrategyConfig {
  /** Unique name of the strategy */
  name: string;
  /** Whether the strategy is enabled */
  enabled: boolean;
  /** Optional configuration parameters for the strategy */
  params?: Record<string, unknown>;
}
