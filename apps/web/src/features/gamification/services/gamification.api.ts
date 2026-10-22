import {
  GamificationEndpoints,
  UserGamificationProfileSchema,
  type UserGamificationProfile,
} from '@pixel-mentor/shared/gamification';

import { apiClient } from '@/services/api-client';

export const gamificationApi = {
  getProfile: async (): Promise<UserGamificationProfile> => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_PROFILE);
    return UserGamificationProfileSchema.parse(data);
  },

  getBadges: async () => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_BADGES);
    return data;
  },

  getUserBadges: async () => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_USER_BADGES);
    return data;
  },

  getStreakHistory: async () => {
    const { data } = await apiClient.get(GamificationEndpoints.GET_STREAK_HISTORY);
    return data;
  },
};
