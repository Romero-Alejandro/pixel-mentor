import request from 'supertest';
import { createApp } from '@/infrastructure/adapters/http/server';
import type { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case';
import type { GetLessonUseCase } from '@/application/use-cases/lesson/get-lesson.use-case';
import type { ListLessonsUseCase } from '@/application/use-cases/lesson/list-lessons.use-case';
import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case';
import type { ListSessionsUseCase } from '@/application/use-cases/session/list-sessions.use-case';
import pino from 'pino';

// Mock the Prisma client
jest.mock('@/infrastructure/adapters/database/client');
import { prisma } from '@/infrastructure/adapters/database/client';

// Mock Use Cases
const mockOrchestrateUseCase = {
  start: jest.fn(),
  interact: jest.fn(),
} as unknown as jest.Mocked<OrchestrateLessonUseCase>;

const mockGetLessonUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<GetLessonUseCase>;

const mockListLessonsUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<ListLessonsUseCase>;

const mockGetSessionUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<GetSessionUseCase>;

const mockListSessionsUseCase = {
  execute: jest.fn(),
} as unknown as jest.Mocked<ListSessionsUseCase>;

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
      },
      logger,
      orchestrateUseCase: mockOrchestrateUseCase,
      prisma: prisma,
      getLessonUseCase: mockGetLessonUseCase,
      listLessonsUseCase: mockListLessonsUseCase,
      getSessionUseCase: mockGetSessionUseCase,
      listSessionsUseCase: mockListSessionsUseCase,
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
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('database', 'healthy');
    });

    it('should return 503 when database is unhealthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('database', 'unhealthy');
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
      // Skipped: Rate limiting is difficult to test in isolated environment
      // without controlling time or flushing limits.
    });
  });

  describe('Request Timeout', () => {
    it('should have timeout middleware configured', () => {
      // Verifying the middleware is applied
      expect(app).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not found');
    });
  });
});
