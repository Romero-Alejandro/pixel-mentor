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
