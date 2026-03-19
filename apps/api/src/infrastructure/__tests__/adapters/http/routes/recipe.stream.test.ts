import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';

import { createApp } from '@/infrastructure/adapters/http/server';
import type { OrchestrateRecipeUseCase } from '@/application/use-cases/orchestrate-recipe.use-case';

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

describe('GET /api/recipe/interact/stream', () => {
  let mockUseCase: jest.Mocked<OrchestrateRecipeUseCase>;
  let app: Express;

  beforeEach(() => {
    mockUseCase = {
      start: jest.fn(),
      interact: jest.fn(),
      interactStream: jest.fn(),
    } as unknown as jest.Mocked<OrchestrateRecipeUseCase>;

    (OrchestrateRecipeUseCase as unknown as jest.Mock).mockReturnValue(mockUseCase);

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
        JWT_SECRET: TEST_JWT_SECRET,
      },
      logger: mockLogger as any,
      orchestrateUseCase: mockUseCase,
      prisma: {} as any,
      getRecipeUseCase: {} as any,
      listRecipesUseCase: {} as any,
      getSessionUseCase: {} as any,
      listSessionsUseCase: {} as any,
      resetSessionUseCase: { execute: jest.fn() } as any,
      completeSessionUseCase: {} as any,
      userRepo: {
        findById: jest.fn().mockResolvedValue({
          id: TEST_USER_ID,
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
        execute: jest.fn().mockResolvedValue({ userId: TEST_USER_ID }),
      } as any,
      questionAnsweringUseCase: {} as any,
      ttsService: {} as any,
    };

    // Enable streaming for most tests
    process.env.ENABLE_STREAMING = 'true';

    app = createApp(mockDeps);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_STREAMING;
  });

  /**
   * Parse raw SSE text into an array of { event, data } objects.
   */
  function parseSSE(raw: string): Array<{ event: string; data: unknown }> {
    const events: Array<{ event: string; data: unknown }> = [];
    const lines = raw.split('\n');

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentData = line.slice(5).trim();
      } else if (line === '') {
        // Blank line marks end of event
        if (currentEvent && currentData) {
          events.push({ event: currentEvent, data: JSON.parse(currentData) });
        }
        currentEvent = '';
        currentData = '';
      }
    }

    return events;
  }

  describe('success cases', () => {
    it('should stream chunk and end events with correct data', async () => {
      // Mock async generator that yields chunks then end
      mockUseCase.interactStream = jest.fn().mockImplementation(async function* () {
        yield { type: 'chunk', text: 'Hello ' };
        yield { type: 'chunk', text: 'world!' };
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: 'EXPLANATION',
          sessionCompleted: false,
          lessonProgress: { currentStep: 0, totalSteps: 5 },
        };
      });

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', `Bearer ${token}`)
        .buffer(true);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');

      const events = parseSSE(response.text);

      expect(events).toHaveLength(3);

      // First chunk
      expect(events[0].event).toBe('chunk');
      expect(events[0].data).toEqual({ text: 'Hello ' });

      // Second chunk
      expect(events[1].event).toBe('chunk');
      expect(events[1].data).toEqual({ text: 'world!' });

      // End event
      expect(events[2].event).toBe('end');
      expect(events[2].data).toEqual({
        reason: 'completed',
        pedagogicalState: 'EXPLANATION',
        sessionCompleted: false,
        lessonProgress: { currentStep: 0, totalSteps: 5 },
      });
    });

    it('should handle single chunk then end', async () => {
      mockUseCase.interactStream = jest.fn().mockImplementation(async function* () {
        yield { type: 'chunk', text: 'Single response' };
        yield {
          type: 'end',
          reason: 'completed',
          pedagogicalState: 'QUESTION',
          sessionCompleted: false,
          lessonProgress: { currentStep: 1, totalSteps: 3 },
        };
      });

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess456', studentInput: 'test' })
        .set('Authorization', `Bearer ${token}`)
        .buffer(true);

      expect(response.status).toBe(200);
      const events = parseSSE(response.text);

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('chunk');
      expect(events[0].data).toEqual({ text: 'Single response' });
      expect(events[1].event).toBe('end');
      expect((events[1].data as any).pedagogicalState).toBe('QUESTION');
    });
  });

  describe('parameter validation', () => {
    it('should return 400 when sessionId is missing', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ studentInput: 'hola' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('sessionId and studentInput required');
    });

    it('should return 400 when studentInput is missing', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('sessionId and studentInput required');
    });

    it('should return 400 when both params are missing', async () => {
      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('sessionId and studentInput required');
    });
  });

  describe('feature flag', () => {
    it('should return 403 when ENABLE_STREAMING is not set', async () => {
      delete process.env.ENABLE_STREAMING;

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Streaming disabled');
    });

    it('should return 403 when ENABLE_STREAMING is set to false', async () => {
      process.env.ENABLE_STREAMING = 'false';

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Streaming disabled');
    });
  });

  describe('use case errors', () => {
    it('should send error event and return 200 when useCase throws', async () => {
      mockUseCase.interactStream = jest.fn().mockImplementation(async function* () {
        yield { type: 'chunk', text: 'partial' };
        throw new Error('Use case stream failed');
      });

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', `Bearer ${token}`)
        .buffer(true);

      // SSE connection is established, so status is 200
      expect(response.status).toBe(200);

      const events = parseSSE(response.text);

      // Should have chunk then error event
      expect(events.some((e) => e.event === 'chunk')).toBe(true);
      expect(events.some((e) => e.event === 'error')).toBe(true);

      const errorEvent = events.find((e) => e.event === 'error');
      expect((errorEvent?.data as any).message).toBe('Use case stream failed');
    });

    it('should send error event when useCase throws immediately', async () => {
      mockUseCase.interactStream = jest.fn().mockImplementation(async function* () {
        throw new Error('Immediate failure');
      });

      const token = generateTestToken();
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', `Bearer ${token}`)
        .buffer(true);

      expect(response.status).toBe(200);

      const events = parseSSE(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();
      expect((errorEvent?.data as any).message).toBe('Immediate failure');
    });
  });

  describe('authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 401 when token is expired', async () => {
      const expiredToken = jwt.sign(
        { userId: TEST_USER_ID, email: 'test@test.com', role: 'STUDENT' },
        TEST_JWT_SECRET,
        { expiresIn: '-1s' }, // already expired
      );

      const response = await request(app)
        .get('/api/recipe/interact/stream')
        .query({ sessionId: 'sess123', studentInput: 'hola' })
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired');
    });
  });
});
