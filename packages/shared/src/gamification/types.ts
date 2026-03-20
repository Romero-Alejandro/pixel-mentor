import { z } from 'zod';

// ==================== Badge Types ====================

// Badge Requirement Schema
export const BadgeRequirementSchema = z.object({
  type: z.enum(['LESSON_COUNT', 'STREAK', 'LEVEL', 'PERFECT_ATTEMPT']),
  target: z.number().int().positive(),
});

export type BadgeRequirement = z.infer<typeof BadgeRequirementSchema>;

// Badge Info Schema
export const BadgeInfoSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  xpReward: z.number().int().nonnegative(),
  requirement: BadgeRequirementSchema,
});

export type BadgeInfo = z.infer<typeof BadgeInfoSchema>;

// Earned Badge Schema
export const EarnedBadgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  earnedAt: z.string().datetime(),
  xpReward: z.number().int().nonnegative(),
});

export type EarnedBadge = z.infer<typeof EarnedBadgeSchema>;

// ==================== Level Types ====================

// Level Info Schema
export const LevelInfoSchema = z.object({
  level: z.number().int().positive(),
  title: z.string(),
  minXP: z.number().int().nonnegative(),
  maxXP: z.number().int().nonnegative(),
});

export type LevelInfo = z.infer<typeof LevelInfoSchema>;

// ==================== XP Types ====================

// XP Change Schema
export const XPChangeSchema = z.object({
  userId: z.string(),
  amount: z.number().int(),
  newTotal: z.number().int().nonnegative(),
  reason: z.string(),
  timestamp: z.string().datetime(),
});

export type XPChange = z.infer<typeof XPChangeSchema>;

// ==================== Level Up Types ====================

// Level Up Info Schema
export const LevelUpInfoSchema = z.object({
  userId: z.string(),
  newLevel: z.number().int().positive(),
  newLevelTitle: z.string(),
  previousLevel: z.number().int().positive(),
  totalXP: z.number().int().nonnegative(),
});

export type LevelUpInfo = z.infer<typeof LevelUpInfoSchema>;

// ==================== Profile Types ====================

// User Gamification Profile Schema
export const UserGamificationProfileSchema = z.object({
  userId: z.string(),
  totalXP: z.number().int().nonnegative(),
  currentLevel: z.number().int().positive(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  levelTitle: z.string(),
  xpToNextLevel: z.number().int().nonnegative(),
  badges: z.array(EarnedBadgeSchema),
});

export type UserGamificationProfile = z.infer<typeof UserGamificationProfileSchema>;

// ==================== Progress Types ====================

// Badge Progress Schema
export const BadgeProgressSchema = z.object({
  badge: BadgeInfoSchema,
  current: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  isEarned: z.boolean(),
});

export type BadgeProgress = z.infer<typeof BadgeProgressSchema>;

// ==================== Summary Types ====================

// Gamification Summary Schema
export const GamificationSummarySchema = z.object({
  profile: UserGamificationProfileSchema,
  levelInfo: LevelInfoSchema,
  badgeProgress: z.array(BadgeProgressSchema),
  recentXPChanges: z.array(XPChangeSchema),
});

export type GamificationSummary = z.infer<typeof GamificationSummarySchema>;
