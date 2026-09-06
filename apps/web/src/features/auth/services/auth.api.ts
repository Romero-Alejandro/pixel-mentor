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

  /**
   * Exchange the httpOnly refresh cookie for a fresh access token.
   * The server reads the refresh token from the cookie, so no body is sent.
   */
  refreshToken: async () => {
    const { data: res } = await apiClient.post('/api/auth/refresh');
    return res as { accessToken: string };
  },

  /** Revokes the server-side session (identified by the httpOnly refresh cookie). */
  logout: async () => {
    await apiClient.post('/api/auth/logout');
  },
};
