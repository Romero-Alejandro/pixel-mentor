import {
  GamificationEndpoints,
  UserGamificationProfileSchema,
  EarnedBadgeSchema,
  type UserGamificationProfile,
  type EarnedBadge,
} from '@pixel-mentor/shared/gamification';

import { apiClient } from '@/services/api-client';

interface ActivityPayload {
  type: 'LESSON_COMPLETED' | 'ACTIVITY_ATTEMPT' | 'DAILY_LOGIN';
}

interface RecordActivityResponse {
  success: boolean;
  profile: UserGamificationProfile;
  levelUp: boolean;
  newBadges: EarnedBadge[];
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

  getBadges: async () => {
    const { data } = await apiClient.get('/api/gamification/badges');
    return data;
  },

  getUserBadges: async () => {
    const { data } = await apiClient.get('/api/gamification/badges/user');
    return data;
  },

  getStreakHistory: async () => {
    const { data } = await apiClient.get('/api/gamification/streak-history');
    return data;
  },
};
