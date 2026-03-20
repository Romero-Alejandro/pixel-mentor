/**
 * Badge Engine Module - Public API for the badge system.
 *
 * This module exports all badge-related types, functions, and classes
 * for use by the game engine and other modules.
 *
 * Usage:
 * ```typescript
 * import { BadgeEngine, getBadgeEngine } from './badge-engine-index';
 *
 * // Using the singleton
 * const engine = getBadgeEngine();
 * const progress = await engine.getBadgeProgress('user-123');
 *
 * // Or creating a new instance
 * const customEngine = new BadgeEngine();
 * ```
 */

// Types
export type {
  BadgeRequirement,
  BadgeRequirementType,
  BadgeDefinition,
  BadgeProgress,
  BadgeAwardResult,
  UserBadgeStats,
} from './badge-types';

// Progress calculation functions
export {
  calculateBadgeProgress,
  getAllBadgeProgress,
  getNearCompletionBadges,
  calculateProgressSummary,
  parseBadgeRules,
  isValidRequirementType,
} from './badge-progress';

// Badge Engine
export { BadgeEngine, getBadgeEngine, resetBadgeEngine } from './badge-engine';
