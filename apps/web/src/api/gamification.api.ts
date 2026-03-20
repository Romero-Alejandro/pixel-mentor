import {
  GamificationEndpoints,
  UserGamificationProfileSchema,
  EarnedBadgeSchema,
  GamificationSummarySchema,
  BadgeInfoSchema,
  type UserGamificationProfile,
  type EarnedBadge,
  type GamificationSummary,
  type BadgeInfo,
} from '@pixel-mentor/shared/gamification';

import { apiClient } from '../services/api';

interface ActivityPayload {
  type: 'LESSON_COMPLETED' | 'ACTIVITY_ATTEMPT' | 'DAILY_LOGIN';
}

interface RecordActivityResponse {
  success: boolean;
  profile: UserGamificationProfile;
  levelUp: boolean;
  newBadges: EarnedBadge[];
}

interface BadgesResponse {
  allBadges: BadgeInfo[];
  earnedBadges: EarnedBadge[];
}

export const gamificationApi = {
  getProfile: async (): Promise<UserGamificationProfile> => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_PROFILE);
    return UserGamificationProfileSchema.parse(data);
  },

  recordActivity: async (payload: ActivityPayload): Promise<RecordActivityResponse> => {
    const { data } = await apiClient.post(GamificationEndpoints.ADD_XP, payload);
    return {
      success: data.success as boolean,
      profile: UserGamificationProfileSchema.parse(data.profile),
      levelUp: data.levelUp as boolean,
      newBadges: EarnedBadgeSchema.array().parse(data.newBadges ?? []),
    };
  },

  getBadges: async (): Promise<BadgesResponse> => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_BADGES);
    return {
      allBadges: BadgeInfoSchema.array().parse(data.allBadges),
      earnedBadges: EarnedBadgeSchema.array().parse(data.earnedBadges),
    };
  },

  getProgress: async (): Promise<GamificationSummary> => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_SUMMARY);
    return GamificationSummarySchema.parse(data);
  },
};
