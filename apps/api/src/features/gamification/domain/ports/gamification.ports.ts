import type { BadgeDefinition } from '../entities/badge.types.js';

export type { BadgeDefinition };

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

export interface IUserGamificationRepository {
  findByUserId(userId: string): Promise<GamificationProfile | null>;
  getOrCreate(userId: string): Promise<GamificationProfile>;
  addXP(
    userId: string,
    amount: number,
  ): Promise<{ newXP: number; leveledUp: boolean; newLevel?: number; newLevelTitle?: string }>;
  updateStreak(
    userId: string,
    data: { currentStreak: number; longestStreak: number; lastActivityAt: Date },
  ): Promise<void>;
  breakStreak(userId: string): Promise<void>;
  getProfileStats(
    userId: string,
  ): Promise<{ currentStreak: number; level: number; totalXP: number; totalBadges: number } | null>;
  getLevelConfig(
    level: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null>;
  getNextLevelConfig(
    currentLevel: number,
  ): Promise<{ level: number; title: string; minXP: number; icon: string } | null>;
}

export interface IBadgeRepository {
  findAll(): Promise<BadgeDefinition[]>;
  findByCode(code: string): Promise<BadgeDefinition | null>;
  getActiveBadges(): Promise<BadgeDefinition[]>;
  awardBadge(userId: string, badgeCode: string): Promise<boolean>;
  awardBadgeWithXP(
    userId: string,
    badgeCode: string,
    xpReward: number,
  ): Promise<{ awarded: boolean; newTotalXP: number }>;
  getUserBadges(
    userId: string,
  ): Promise<
    Array<{ code: string; name: string; icon: string; description: string; earnedAt: Date }>
  >;
  getUserBadgeCount(userId: string): Promise<number>;
  getUserBadgeStats(
    userId: string,
  ): Promise<{ totalEarned: number; totalXPFromBadges: number; byType: Record<string, number> }>;
  hasBadge(userId: string, badgeCode: string): Promise<boolean>;
}
