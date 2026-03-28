import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPost, mockGet, mockInterceptors } = vi.hoisted(() => {
  const mockInterceptors = {
    request: {
      use: vi.fn((fn) => fn({})),
    },
    response: {
      use: vi.fn((fn) => fn),
    },
  };

  return {
    mockPost: vi.fn(),
    mockGet: vi.fn(),
    mockInterceptors,
  };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      interceptors: mockInterceptors,
    })),
  },
}));

// Need to import after mock is set up
import '../../services/api';
import { api } from '../../services/api';

describe('ApiService', () => {
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

      const result = await api.login({ identifier: 'test@test.com', password: 'password123' });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
        identifier: 'test@test.com',
        password: 'password123',
      });
      expect(result).toHaveProperty('token', 'jwt-token-123');
      expect(result.user).toHaveProperty('email', 'test@test.com');
    });

    it('should throw error on invalid credentials', async () => {
      const mockError = new Error('Request failed with status code 401');
      Object.defineProperty(mockError, 'response', {
        value: {
          status: 401,
          data: { error: 'Invalid email or password' },
        },
      });
      mockPost.mockRejectedValueOnce(mockError);

      await expect(api.login({ identifier: 'test@test.com', password: 'wrong' })).rejects.toThrow(
        'Request failed with status code 401',
      );
    });

    it('should throw error on network failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        api.login({ identifier: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow('Network error');
    });
  });

  describe('register', () => {
    it('should register successfully with valid data', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
          token: 'jwt-token-123',
        },
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await api.register({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test',
        username: 'testuser',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/register', {
        email: 'test@test.com',
        password: 'password123',
        name: 'Test',
        username: 'testuser',
      });
      expect(result).toHaveProperty('token', 'jwt-token-123');
    });
  });

  describe('listRecipes', () => {
    it('should fetch recipes successfully', async () => {
      const mockRecipes = [
        { id: '1', title: 'Recipe 1', canonicalId: 'c1', version: '1.0', published: true },
        { id: '2', title: 'Recipe 2', canonicalId: 'c2', version: '1.0', published: false },
      ];
      const mockResponse = { data: mockRecipes };
      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await api.listRecipes(true);

      expect(mockGet).toHaveBeenCalledWith('/api/recipes?activeOnly=true');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('title', 'Recipe 1');
    });

    it('should return empty array when no recipes', async () => {
      const mockResponse = { data: [] };
      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await api.listRecipes(true);

      expect(result).toHaveLength(0);
    });
  });

  describe('startRecipe', () => {
    it('should start a recipe successfully', async () => {
      const mockResponse = {
        data: {
          sessionId: 'session-123',
          voiceText: 'Welcome to the lesson!',
          pedagogicalState: 'EXPLANATION',
        },
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await api.startRecipe('recipe-123');

      expect(mockPost).toHaveBeenCalledWith('/api/recipe/start', { recipeId: 'recipe-123' });
      expect(result).toHaveProperty('sessionId', 'session-123');
      expect(result).toHaveProperty('voiceText', 'Welcome to the lesson!');
    });
  });

  describe('interactWithRecipe', () => {
    it('should send student input and get response', async () => {
      const mockResponse = {
        data: {
          voiceText: 'Great answer!',
          pedagogicalState: 'QUESTION',
          sessionCompleted: false,
        },
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await api.interactWithRecipe('session-123', 'My answer');

      expect(mockPost).toHaveBeenCalledWith('/api/recipe/interact', {
        sessionId: 'session-123',
        studentInput: 'My answer',
      });
      expect(result).toHaveProperty('voiceText', 'Great answer!');
      expect(result).toHaveProperty('pedagogicalState', 'QUESTION');
    });

    it('should handle session completion', async () => {
      const mockResponse = {
        data: {
          voiceText: 'Congratulations! Lesson complete!',
          pedagogicalState: 'EVALUATION',
          sessionCompleted: true,
        },
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await api.interactWithRecipe('session-123', 'Final answer');

      expect(result.sessionCompleted).toBe(true);
    });
  });
});
