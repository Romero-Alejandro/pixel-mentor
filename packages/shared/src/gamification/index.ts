// Re-export all gamification types and schemas
export * from './types';
export * from './api';
export * from './endpoints';

// ==================== Type Exports ====================

// Named exports for convenience
export type {
  BadgeInfo,
  BadgeProgress,
  BadgeRequirement,
  EarnedBadge,
  GamificationSummary,
  LevelInfo,
  LevelUpInfo,
  UserGamificationProfile,
  XPChange,
} from './types';

export type {
  BadgeListResponse,
  GamificationAPIResponse,
  GamificationSummaryResponse,
  UserGamificationResponse,
  XPChangeResponse,
} from './api';

export type { GamificationEndpointKey } from './endpoints';
