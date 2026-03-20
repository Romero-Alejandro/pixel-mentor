// ==================== Gamification API Endpoints ====================

// Base path for gamification API
const GAMIFICATION_BASE = '/api/gamification';

/**
 * Gamification API endpoint constants
 * Use these to ensure consistency between frontend and backend
 */
export const GamificationEndpoints = {
  // Profile endpoints
  GET_PROFILE: `${GAMIFICATION_BASE}/profile`,
  GET_PROFILE_BY_USER: (userId: string) => `${GAMIFICATION_BASE}/profile/${userId}`,

  // Summary endpoint
  GET_SUMMARY: `${GAMIFICATION_BASE}/summary`,

  // Badge endpoints
  GET_BADGES: `${GAMIFICATION_BASE}/badges`,
  GET_USER_BADGES: (userId: string) => `${GAMIFICATION_BASE}/badges/${userId}`,

  // XP endpoints
  GET_XP_CHANGES: `${GAMIFICATION_BASE}/xp`,
  GET_USER_XP_CHANGES: (userId: string) => `${GAMIFICATION_BASE}/xp/${userId}`,
  ADD_XP: `${GAMIFICATION_BASE}/xp/add`,

  // Level endpoints
  GET_LEVELS: `${GAMIFICATION_BASE}/levels`,
  GET_LEVEL_INFO: (level: number) => `${GAMIFICATION_BASE}/levels/${level}`,

  // Streak endpoints
  GET_STREAK: `${GAMIFICATION_BASE}/streak`,
  GET_USER_STREAK: (userId: string) => `${GAMIFICATION_BASE}/streak/${userId}`,

  // Badge progress
  GET_BADGE_PROGRESS: (userId: string) => `${GAMIFICATION_BASE}/progress/${userId}`,
} as const;

// Type for endpoint keys
export type GamificationEndpointKey = keyof typeof GamificationEndpoints;
