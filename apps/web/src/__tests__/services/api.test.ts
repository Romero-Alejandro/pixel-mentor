import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock api-client BEFORE importing authApi
vi.mock('../../services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getToken: vi.fn(() => 'mock-token'),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

// Now import authApi - it will use the mocked apiClient
import { authApi } from '../../features/auth/services/auth.api';
import { apiClient } from '../../services/api-client';

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
          token: 'jwt-token-123',
        },
      };
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const result = await authApi.login({ identifier: 'test@test.com', password: 'password123' });

      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
        identifier: 'test@test.com',
        password: 'password123',
      });
      expect(result).toHaveProperty('token', 'jwt-token-123');
      expect(result.user).toHaveProperty('email', 'test@test.com');
    });

    it('should throw error on invalid credentials', async () => {
      const mockError = new Error('Request failed with status code 401');
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(mockError);

      await expect(
        authApi.login({ identifier: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@test.com', name: 'Test User', role: 'STUDENT', quota: 0 },
          token: 'jwt-token-456',
        },
      };
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const result = await authApi.register({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', {
        email: 'test@test.com',
        password: 'password123',
        name: 'Test User',
        username: undefined,
      });
      expect(result).toHaveProperty('token', 'jwt-token-456');
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user', async () => {
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      const result = await authApi.getCurrentUser();

      expect(apiClient.get).toHaveBeenCalledWith('/api/auth/me');
      expect(result.user).toEqual(mockUser);
    });
  });
});
