import { describe, it, expect, beforeEach, vi } from 'vitest';

import { authApi } from '../../features/auth/services/auth.api';

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      interceptors: {
        request: { use: vi.fn((fn) => fn({})) },
        response: { use: vi.fn((fn) => fn) },
      },
    })),
  },
}));

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
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await authApi.login({ identifier: 'test@test.com', password: 'password123' });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
        identifier: 'test@test.com',
        password: 'password123',
      });
      expect(result).toHaveProperty('token', 'jwt-token-123');
      expect(result.user).toHaveProperty('email', 'test@test.com');
    });

    it('should throw error on invalid credentials', async () => {
      const mockError = new Error('Request failed with status code 401');
      mockPost.mockRejectedValueOnce(mockError);

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
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await authApi.register({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
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
      mockGet.mockResolvedValueOnce({ data: { user: mockUser } });

      const result = await authApi.getCurrentUser();

      expect(mockGet).toHaveBeenCalledWith('/api/auth/me');
      expect(result.user).toEqual(mockUser);
    });
  });
});
