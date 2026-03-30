import request from 'supertest';
import pino from 'pino';

import { createApp } from '../../../../infrastructure/adapters/http/server';
import type { OrchestrateRecipeUseCase } from '../../../../../application/use-cases';
import type { GetRecipeUseCase } from '../../../../../application/use-cases/recipe/get-recipe.use-case';
import type { ListRecipesUseCase } from '../../../../../application/use-cases/recipe/list-recipes.use-case';
import type { GetSessionUseCase } from '../../../../../application/use-cases/session/get-session.use-case';
import type { ListSessionsUseCase } from '../../../../../application/use-cases/session/list-sessions.use-case';

// Mock the Prisma client
jest.mock('@/infrastructure/adapters/database/client');
import { prisma } from '@/infrastructure/adapters/database/client';

// Mock Use Cases
const mockOrchestrateUseCase = {
  start: jest.fn(),
  interact: jest.fn(),
} as unknown as jest.Mocked<OrchestrateRecipeUseCase>;

const mockGetRecipeUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<GetRecipeUseCase>;

const mockListRecipesUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<ListRecipesUseCase>;

const mockGetSessionUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<GetSessionUseCase>;

const mockListSessionsUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<ListSessionsUseCase>;

const mockResetSessionUseCase: any = { execute: jest.fn() };
const mockUserRepo: any = {};
const mockRegisterUseCase: any = {};
const mockLoginUseCase: any = {};
const mockVerifyTokenUseCase: any = {};

describe('HTTP Server', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const logger = pino({ level: 'silent' });
    app = createApp({
      config: {
        NODE_ENV: 'test',
        PORT: 3000,
        CORS_ORIGIN: 'http://localhost:3000',
        LOG_LEVEL: 'info' as const,
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 10,
        RATE_LIMIT_MAX_INTERACT: 5,
        REQUEST_TIMEOUT_MS: 30000,
        JWT_SECRET: 'test-secret-key',
      },
      logger,
      orchestrateUseCase: mockOrchestrateUseCase,
      prisma: prisma,
      getRecipeUseCase: mockGetRecipeUseCase,
      listRecipesUseCase: mockListRecipesUseCase,
      getSessionUseCase: mockGetSessionUseCase,
      listSessionsUseCase: mockListSessionsUseCase,
      resetSessionUseCase: mockResetSessionUseCase,
      userRepository: mockUserRepo,
      registerUseCase: mockRegisterUseCase,
      loginUseCase: mockLoginUseCase,
      verifyTokenUseCase: mockVerifyTokenUseCase,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return 200 when database is healthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body.checks.database).toHaveProperty('status', 'up');
    });

    it('should return 503 when database is unhealthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.checks.database).toHaveProperty('status', 'down');
    });
  });

  describe('Info Endpoint', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Pixel Mentor API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('status', 'running');
    });
  });

  describe('CORS', () => {
    it('should allow configured origin', async () => {
      const response = await request(app).get('/api').set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Rate Limiting', () => {
    it.skip('should apply rate limiting to /api endpoints', async () => {
      // Test implementation pending
    });
  });

  // Add more tests as needed
});
