// ==================== Gamification API Endpoints ====================

// Base path for gamification API
const GAMIFICATION_BASE = '/api/gamification';

/**
 * Gamification API endpoint constants.
 * Only endpoints that exist on the server live here, so the frontend cannot
 * call a route that was never implemented.
 */
export const GamificationEndpoints = {
  // Profile
  GET_PROFILE: `${GAMIFICATION_BASE}/profile`,

  // Badges
  GET_BADGES: `${GAMIFICATION_BASE}/badges`,
  GET_USER_BADGES: `${GAMIFICATION_BASE}/badges/user`,

  // Progress and streaks
  GET_PROGRESS: `${GAMIFICATION_BASE}/progress`,
  GET_STREAK_HISTORY: `${GAMIFICATION_BASE}/streak-history`,

  // Session mission report
  GET_MISSION_REPORT: (sessionId: string) =>
    `${GAMIFICATION_BASE}/mission-report/${sessionId}`,
} as const;

// Type for endpoint keys
export type GamificationEndpointKey = keyof typeof GamificationEndpoints;
