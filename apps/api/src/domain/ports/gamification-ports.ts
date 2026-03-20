/**
 * Domain ports (interfaces) for gamification.
 * Following Clean Architecture: interfaces define contracts, implementations are in infrastructure.
 */

/**
 * Result of processing game events and calculating rewards.
 */
export interface RewardResult {
  xpAwarded: number;
  newTotalXP: number;
  leveledUp: boolean;
  newLevel?: number;
  newLevelTitle?: string;
  badgesEarned: Array<{
    code: string;
    name: string;
    icon: string;
  }>;
  streakUpdated: boolean;
  newStreak?: number;
  isNewStreak?: boolean;
}

/**
 * User's gamification profile for the UI.
 */
export interface GamificationProfile {
  userId: string;
  level: number;
  levelTitle: string;
  currentXP: number;
  xpToNextLevel: number;
  xpProgressPercent: number;
  streak: number;
  longestStreak: number;
  lastActivityAt: Date | null;
  totalBadges: number;
  badges: Array<{
    code: string;
    name: string;
    icon: string;
    description: string;
    earnedAt: Date;
  }>;
}

/**
 * Repository port for user gamification data.
 */
export interface IUserGamificationRepository {
  findByUserId(userId: string): Promise<GamificationProfile | null>;
  getOrCreate(userId: string): Promise<GamificationProfile>;
  addXP(
    userId: string,
    amount: number,
  ): Promise<{ newXP: number; leveledUp: boolean; newLevel?: number; newLevelTitle?: string }>;
  updateStreak(userId: string, newStreak: number, longestStreak: number): Promise<void>;
  getLevelConfig(
    level: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null>;
  getNextLevelConfig(
    currentLevel: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null>;
}

/**
 * Repository port for badges.
 */
export interface IBadgeRepository {
  findAll(): Promise<
    Array<{
      code: string;
      name: string;
      description: string;
      icon: string;
      xpReward: number;
      rules: Record<string, unknown>;
    }>
  >;
  findByCode(code: string): Promise<{
    code: string;
    name: string;
    icon: string;
    xpReward: number;
  } | null>;
  awardBadge(userId: string, badgeCode: string): Promise<boolean>; // returns true if newly awarded
  getUserBadges(userId: string): Promise<
    Array<{
      code: string;
      name: string;
      icon: string;
      description: string;
      earnedAt: Date;
    }>
  >;
  hasBadge(userId: string, badgeCode: string): Promise<boolean>;
}
