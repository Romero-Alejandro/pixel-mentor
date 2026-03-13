import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';

import { createApp } from '@/infrastructure/adapters/http/server';
import { OrchestrateRecipeUseCase } from '@/application/use-cases/orchestrate-recipe.use-case';

jest.mock('@/application/use-cases/orchestrate-recipe.use-case');

const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_JWT_SECRET = 'test-secret-key';

const generateTestToken = () => {
  return jwt.sign(
    { userId: TEST_USER_ID, email: 'test@test.com', role: 'STUDENT' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
};

describe('Recipe Routes', () => {
  let mockUseCase: any;
  let app: Express;

  beforeEach(() => {
    mockUseCase = {
      start: jest.fn(),
      interact: jest.fn(),
    };

    (OrchestrateRecipeUseCase as jest.Mock).mockReturnValue(mockUseCase);

    const mockLogger = {
      ...console,
      child: jest.fn().mockReturnThis(),
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
      orchestrateUseCase: mockUseCase,
      prisma: {} as any,
      getRecipeUseCase: {} as any,
      listRecipesUseCase: {} as any,
      getSessionUseCase: {} as any,
      listSessionsUseCase: {} as any,
      resetSessionUseCase: { execute: jest.fn() } as any,
      userRepo: {
        findById: jest.fn().mockResolvedValue({
          id: '123e4567-e89b-12d3-a456-426614174001',
          email: 'test@test.com',
          name: 'Test User',
          role: 'STUDENT',
          quota: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as any,
      registerUseCase: {} as any,
      loginUseCase: {} as any,
      verifyTokenUseCase: {
        execute: jest.fn().mockResolvedValue({ userId: '123e4567-e89b-12d3-a456-426614174001' }),
      } as any,
    };

    app = createApp(mockDeps);
  });

  it('should start a lesson', async () => {
    mockUseCase.start.mockResolvedValue({
      sessionId: 'session-1',
      voiceText: 'Recipe started',
      pedagogicalState: 'EXPLANATION',
    });

    const token = generateTestToken();
    const response = await request(app)
      .post('/api/recipe/start')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipeId: '123e4567-e89b-12d3-a456-426614174000',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('sessionId');
    expect(response.body.voiceText).toBe('Recipe started');
  });

  it('should interact with a lesson', async () => {
    mockUseCase.interact.mockResolvedValue({
      voiceText: 'Test response',
      pedagogicalState: 'QUESTION',
      sessionCompleted: false,
    });

    const token = generateTestToken();
    const response = await request(app)
      .post('/api/recipe/interact')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: '123e4567-e89b-12d3-a456-426614174002',
        studentInput: 'Test input',
      });

    expect(response.status).toBe(200);
    expect(response.body.voiceText).toBe('Test response');
    expect(response.body.pedagogicalState).toBe('QUESTION');
  });

  it('should return 400 for invalid input', async () => {
    const token = generateTestToken();
    const response = await request(app)
      .post('/api/recipe/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app).post('/api/recipe/start').send({
      recipeId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(response.status).toBe(401);
  });
});
