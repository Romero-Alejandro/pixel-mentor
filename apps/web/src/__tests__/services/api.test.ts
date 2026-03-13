import { describe, it, expect, beforeEach, vi } from 'vitest';

import { api } from '../../services/api';

const API_URL = 'http://localhost:3001';

vi.mock('fetch', () => ({
  default: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('ApiService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          user: { id: '1', email: 'test@test.com', name: 'Test', role: 'STUDENT', quota: 0 },
          token: 'jwt-token-123',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.login({ email: 'test@test.com', password: 'password123' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/auth/login`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
        }),
      );
      expect(result).toHaveProperty('token', 'jwt-token-123');
      expect(result.user).toHaveProperty('email', 'test@test.com');
    });

    it('should throw error on invalid credentials', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Invalid email or password' }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(api.login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        api.login({ email: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should register successfully with valid data', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          user: { id: '1', email: 'new@test.com', name: 'New User', role: 'STUDENT', quota: 0 },
          token: 'jwt-token-456',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.register({
        email: 'new@test.com',
        password: 'password123',
        name: 'New User',
        role: 'STUDENT',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/auth/register`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'new@test.com',
            password: 'password123',
            name: 'New User',
            role: 'STUDENT',
          }),
        }),
      );
      expect(result).toHaveProperty('token', 'jwt-token-456');
    });
  });

  describe('listLessons', () => {
    it('should fetch lessons successfully', async () => {
      const mockLessons = [
        { id: '1', titulo: 'Math 101', descripcion: 'Basic math', activa: true },
        { id: '2', titulo: 'Physics 101', descripcion: 'Basic physics', activa: true },
      ];
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockLessons),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.listLessons();

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/lessons?activeOnly=true`,
        expect.objectContaining({}),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('titulo', 'Math 101');
    });

    it('should return empty array when no lessons', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.listLessons();

      expect(result).toHaveLength(0);
    });
  });

  describe('startLesson', () => {
    it('should start a lesson successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          sessionId: 'session-123',
          voiceText: 'Welcome to the lesson!',
          pedagogicalState: 'EXPLANATION',
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.startLesson('lesson-123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/leccion/start`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ lessonId: 'lesson-123' }),
        }),
      );
      expect(result).toHaveProperty('sessionId', 'session-123');
      expect(result).toHaveProperty('voiceText', 'Welcome to the lesson!');
    });
  });

  describe('interactWithLesson', () => {
    it('should send student input and get response', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          voiceText: 'Great answer!',
          pedagogicalState: 'QUESTION',
          sessionCompleted: false,
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.interactWithLesson('session-123', 'My answer');

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/leccion/interact`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'session-123', studentInput: 'My answer' }),
        }),
      );
      expect(result).toHaveProperty('voiceText', 'Great answer!');
      expect(result).toHaveProperty('pedagogicalState', 'QUESTION');
    });

    it('should handle session completion', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          voiceText: 'Congratulations! Lesson complete!',
          pedagogicalState: 'EVALUATION',
          sessionCompleted: true,
        }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await api.interactWithLesson('session-123', 'Final answer');

      expect(result.sessionCompleted).toBe(true);
    });
  });
});
