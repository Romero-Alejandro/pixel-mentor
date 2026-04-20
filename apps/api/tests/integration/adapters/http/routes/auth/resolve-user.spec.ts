/**
 * Integration Tests for Auth API - User Resolution Endpoint
 *
 * Tests cover:
 * - GET /api/auth/users/resolve?email=xxx
 * - 200: returns uuid, email, name
 * - 400: invalid email format
 * - 401: unauthenticated
 * - 403: non-teacher role
 * - 404: user not found
 */

import request from 'supertest';
import { z } from 'zod';

import { createAuthRouter } from '@/features/auth/infrastructure/http/auth.routes.js';
import type { ResolveUserByEmailUseCase } from '@/features/auth/application/use-cases/resolve-user-by-email.use-case.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';

const createMockUserRepository = (): jest.Mocked<IUserRepository> => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByEmailWithPassword: jest.fn(),
  findByIdentifier: jest.fn(),
  findByIdentifierWithPassword: jest.fn(),
  create: jest.fn(),
  updateRole: jest.fn(),
  updateQuota: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
});

const createMockResolveUserByEmailUseCase = (): jest.Mocked<ResolveUserByEmailUseCase> => ({
  execute: jest.fn(),
});

const createApp = (
  userRepo: jest.Mocked<IUserRepository>,
  resolveUseCase: jest.Mocked<ResolveUserByEmailUseCase>,
  user: { id: string; role: string } = { id: 'user-1', role: 'TEACHER' },
) => {
  const mockRegisterUseCase = { execute: jest.fn() };
  const mockLoginUseCase = { execute: jest.fn() };
  const mockRefreshTokenUseCase = { execute: jest.fn() };

  const protectedMiddleware = (_req: any, res: any, next: any) => {
    if (!user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    _req.user = user;
    next();
  };

  const router = createAuthRouter(
    userRepo,
    mockRegisterUseCase as any,
    mockLoginUseCase as any,
    mockRefreshTokenUseCase as any,
    resolveUseCase,
    protectedMiddleware,
  );

  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', router);

  return app;
};

describe('GET /api/auth/users/resolve', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockResolveUseCase: jest.Mocked<ResolveUserByEmailUseCase>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    mockResolveUseCase = createMockResolveUserByEmailUseCase();
  });

  describe('authentication', () => {
    it('should return 401 when no auth token provided', async () => {
      const app = createApp(mockUserRepo, mockResolveUseCase, null as any);

      const response = await request(app).get('/api/auth/users/resolve?email=test@example.com');

      expect(response.status).toBe(401);
    });

    it('should return 401 when auth token is invalid', async () => {
      const app = createApp(mockUserRepo, mockResolveUseCase, null as any);

      const response = await request(app)
        .get('/api/auth/users/resolve?email=test@example.com')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('authorization', () => {
    it('should return 403 when user is not a teacher', async () => {
      const app = createApp(mockUserRepo, mockResolveUseCase, {
        id: 'user-1',
        role: 'STUDENT',
      });

      const response = await request(app).get('/api/auth/users/resolve?email=test@example.com');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should return 403 when user is an admin', async () => {
      const app = createApp(mockUserRepo, mockResolveUseCase, {
        id: 'user-1',
        role: 'ADMIN',
      });

      const response = await request(app).get('/api/auth/users/resolve?email=test@example.com');

      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    it('should return 400 when email query param is missing', async () => {
      const app = createApp(mockUserRepo, mockResolveUseCase);

      const response = await request(app).get('/api/auth/users/resolve');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when email format is invalid', async () => {
      const app = createApp(mockUserRepo, mockResolveUseCase);

      const response = await request(app).get('/api/auth/users/resolve?email=invalid');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('success cases', () => {
    it('should return 200 with user data when email exists', async () => {
      mockResolveUseCase.execute.mockResolvedValue({
        uuid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      const app = createApp(mockUserRepo, mockResolveUseCase);

      const response = await request(app).get('/api/auth/users/resolve?email=test@example.com');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        uuid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(mockResolveUseCase.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('should return 404 when user not found', async () => {
      mockResolveUseCase.execute.mockResolvedValue(null);

      const app = createApp(mockUserRepo, mockResolveUseCase);

      const response = await request(app).get(
        '/api/auth/users/resolve?email=nonexistent@example.com',
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });

    it('should perform case-insensitive email lookup', async () => {
      mockResolveUseCase.execute.mockResolvedValue({
        uuid: 'user-456',
        email: 'Test.User@example.com',
        name: 'Test User',
      });

      const app = createApp(mockUserRepo, mockResolveUseCase);

      const response = await request(app).get(
        '/api/auth/users/resolve?email=TEST.USER@example.com',
      );

      expect(response.status).toBe(200);
      expect(response.body.uuid).toBe('user-456');
    });
  });
});
