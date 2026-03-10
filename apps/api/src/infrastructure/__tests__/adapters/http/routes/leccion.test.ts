import request from 'supertest';
import { createApp } from '@/infrastructure/adapters/http/server';
import { OrchestrateLessonUseCase } from '@/application/use-cases/orchestrate-lesson.use-case';
import type { Express } from 'express';

jest.mock('@/application/use-cases/orchestrate-lesson.use-case');

describe('Leccion Routes', () => {
  let mockUseCase: any;
  let app: Express;

  beforeEach(() => {
    mockUseCase = {
      start: jest.fn(),
      interact: jest.fn(),
    };

    (OrchestrateLessonUseCase as jest.Mock).mockReturnValue(mockUseCase);

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
      },
      logger: mockLogger as any,
      orchestrateUseCase: mockUseCase,
      prisma: {} as any,
      getLessonUseCase: {} as any,
      listLessonsUseCase: {} as any,
      getSessionUseCase: {} as any,
      listSessionsUseCase: {} as any,
    };

    app = createApp(mockDeps);
  });

  it('should start a lesson', async () => {
    mockUseCase.start.mockResolvedValue({
      sessionId: 'session-1',
      voiceText: 'Lesson started',
      pedagogicalState: 'EXPLANATION',
    });

    const response = await request(app).post('/api/leccion/start').send({
      lessonId: '123e4567-e89b-12d3-a456-426614174000',
      studentId: '123e4567-e89b-12d3-a456-426614174001',
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('sessionId');
    expect(response.body.voiceText).toBe('Lesson started');
  });

  it('should interact with a lesson', async () => {
    mockUseCase.interact.mockResolvedValue({
      voiceText: 'Test response',
      pedagogicalState: 'QUESTION',
      sessionCompleted: false,
    });

    const response = await request(app).post('/api/leccion/interact').send({
      sessionId: '123e4567-e89b-12d3-a456-426614174002',
      studentInput: 'Test input',
    });

    expect(response.status).toBe(200);
    expect(response.body.voiceText).toBe('Test response');
    expect(response.body.pedagogicalState).toBe('QUESTION');
  });

  it('should return 400 for invalid input', async () => {
    const response = await request(app).post('/api/leccion/start').send({});

    expect(response.status).toBe(400);
  });
});
