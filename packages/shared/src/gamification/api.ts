import { z } from 'zod';

import {
  BadgeInfoSchema,
  EarnedBadgeSchema,
  GamificationSummarySchema,
  UserGamificationProfileSchema,
} from './types';

// ==================== API Response Wrapper ====================

// Standard API Response Schema
export const GamificationAPIResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.string().nullish(),
    timestamp: z.string().datetime(),
  });

export type GamificationAPIResponse<T> = z.infer<
  ReturnType<typeof GamificationAPIResponseSchema<z.ZodType<T>>>
>;

// ==================== API Response Types ====================

// User Gamification Response
export const UserGamificationResponseSchema = GamificationAPIResponseSchema(
  UserGamificationProfileSchema,
);

export type UserGamificationResponse = z.infer<typeof UserGamificationResponseSchema>;

// Badge List Response
export const BadgeListResponseSchema = GamificationAPIResponseSchema(
  z.object({
    allBadges: z.array(BadgeInfoSchema),
    earnedBadges: z.array(EarnedBadgeSchema),
  }),
);

export type BadgeListResponse = z.infer<typeof BadgeListResponseSchema>;

// Gamification Summary Response
export const GamificationSummaryResponseSchema =
  GamificationAPIResponseSchema(GamificationSummarySchema);

export type GamificationSummaryResponse = z.infer<typeof GamificationSummaryResponseSchema>;

// XP Change Response
export const XPChangeResponseSchema = GamificationAPIResponseSchema(
  z.object({
    userId: z.string(),
    amount: z.number().int(),
    newTotal: z.number().int().nonnegative(),
    reason: z.string(),
    newLevel: z.number().int().positive().nullish(),
    newLevelTitle: z.string().nullish(),
  }),
);

export type XPChangeResponse = z.infer<typeof XPChangeResponseSchema>;
