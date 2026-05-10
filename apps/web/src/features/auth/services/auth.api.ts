import { UserSchema, AuthResponseSchema } from '@pixel-mentor/shared';
import type { User, Role } from '@pixel-mentor/shared';

import { apiClient } from '@/services/api-client';

export { type User, type Role };

export const authApi = {
  login: async (data: { identifier: string; password: string }) => {
    const { data: res } = await apiClient.post('/api/auth/login', data);
    return AuthResponseSchema.parse(res);
  },

  register: async (data: { email: string; password: string; name: string; username?: string }) => {
    const { data: res } = await apiClient.post('/api/auth/register', data);
    return AuthResponseSchema.parse(res);
  },

  getCurrentUser: async () => {
    const { data } = await apiClient.get('/api/auth/me');
    return { user: UserSchema.parse(data.user) };
  },

  refreshToken: async (data: { refreshToken: string }) => {
    const { data: res } = await apiClient.post('/api/auth/refresh', data);
    // The refresh endpoint returns accessToken and refreshToken, but not the full AuthResponse
    return res as { accessToken: string; refreshToken: string };
  },

  logout: async (data: { userId: string; refreshToken: string }) => {
    await apiClient.post('/api/auth/logout', data);
  },
};
