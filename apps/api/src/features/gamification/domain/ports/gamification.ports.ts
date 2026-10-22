import type { BadgeDefinition } from '@/features/gamification/domain/entities/badge.types.js';

export type { BadgeDefinition };

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
  updateStreak(
    userId: string,
    data: { currentStreak: number; longestStreak: number; lastActivityAt: Date },
  ): Promise<void>;
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

export interface GamificationAuditLogEntry {
  id?: string;
  userId: string;
  eventType: string;
  details?: Record<string, unknown>;
  xpAwarded: number;
  badgesAwarded?: string[];
  succeeded: boolean;
  errorMessage?: string;
  createdAt?: Date;
}

export interface IGamificationAuditRepository {
  logEvent(entry: GamificationAuditLogEntry): Promise<void>;
  getLogsByUserId(userId: string, limit?: number): Promise<GamificationAuditLogEntry[]>;
  getLogsByEventType(eventType: string, limit?: number): Promise<GamificationAuditLogEntry[]>;
}
