import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '@/infrastructure/adapters/http/server';
import type { RegisterUseCase } from '@/application/use-cases/auth/register.use-case';
import type { LoginUseCase } from '@/application/use-cases/auth/login.use-case';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case';

jest.mock('@/application/use-cases/auth/register.use-case');
jest.mock('@/application/use-cases/auth/login.use-case');
jest.mock('@/application/use-cases/auth/verify-token.use-case');

describe('Auth API Endpoints', () => {
  let app: Express;
  let mockRegisterUseCase: jest.Mocked<RegisterUseCase>;
  let mockLoginUseCase: jest.Mocked<LoginUseCase>;
  let mockVerifyTokenUseCase: jest.Mocked<VerifyTokenUseCase>;

  beforeEach(() => {
    mockRegisterUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RegisterUseCase>;

    mockLoginUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<LoginUseCase>;

    mockVerifyTokenUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<VerifyTokenUseCase>;

    const mockLogger = {
      ...console,
      child: jest.fn().mockReturnThis(),
    };

    const mockUserRepo = {
      findById: jest.fn().mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'test@test.com',
        name: 'Test User',
        role: 'STUDENT',
        quota: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
    };

    const mockDeps = {
      config: {
        NODE_ENV: 'test' as const,
        PORT: 3000,
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info' as const,
        RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
        RATE_LIMIT_MAX: 100,
        RATE_LIMIT_MAX_INTERACT: 10,
        REQUEST_TIMEOUT_MS: 10000,
        JWT_SECRET: 'test-secret-key',
      },
      logger: mockLogger as any,
      orchestrateUseCase: {} as any,
      prisma: {} as any,
      getRecipeUseCase: {} as any,
      listRecipesUseCase: {} as any,
      getSessionUseCase: {} as any,
      listSessionsUseCase: {} as any,
      resetSessionUseCase: { execute: jest.fn() } as any,
      userRepo: mockUserRepo as any,
      registerUseCase: mockRegisterUseCase,
      loginUseCase: mockLoginUseCase,
      verifyTokenUseCase: mockVerifyTokenUseCase,
    };

    app = createApp(mockDeps);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      mockRegisterUseCase.execute.mockResolvedValueOnce({
        user: {
          id: 'new-user-id',
          email: 'new@example.com',
          name: 'New User',
          role: 'STUDENT',
          quota: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token-123',
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        role: 'STUDENT',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('new@example.com');
    });

    it('should reject duplicate email', async () => {
      mockRegisterUseCase.execute.mockRejectedValueOnce(new Error('User already exists'));

      const response = await request(app).post('/api/auth/register').send({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
        role: 'STUDENT',
      });

      expect(response.status).toBe(500);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'password123',
        name: 'Test User',
        role: 'STUDENT',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should reject short password', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: '12345',
        name: 'Test User',
        role: 'STUDENT',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should reject missing fields', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockLoginUseCase.execute.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'STUDENT',
          quota: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token-123',
      });

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      mockLoginUseCase.execute.mockRejectedValueOnce(new Error('Invalid credentials'));

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject missing email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        password: 'password123',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      mockVerifyTokenUseCase.execute.mockResolvedValueOnce({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT',
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should reject request with invalid token', async () => {
      mockVerifyTokenUseCase.execute.mockRejectedValueOnce(new Error('Invalid token'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
