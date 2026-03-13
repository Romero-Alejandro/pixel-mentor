import express from 'express';
import request from 'supertest';

import { createSessionsRouter } from '@/infrastructure/adapters/http/routes/sessions';

describe('Sessions Routes', () => {
  let mockGetSessionUseCase: any;
  let mockListSessionsUseCase: any;
  let mockResetSessionUseCase: any;
  let app: express.Express;

  beforeEach(() => {
    mockGetSessionUseCase = { execute: jest.fn() };
    mockListSessionsUseCase = { execute: jest.fn() };
    mockResetSessionUseCase = { execute: jest.fn() };

    const router = createSessionsRouter(
      mockGetSessionUseCase,
      mockListSessionsUseCase,
      mockResetSessionUseCase,
    );
    app = express();
    app.use(router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /:id', () => {
    it('should return 200 with session data', async () => {
      const session = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        studentId: '223e4567-e89b-12d3-a456-426614174002',
        lessonId: 'lec-1',
        status: 'active',
        stateCheckpoint: {
          currentState: 'ACTIVE_CLASS',
          currentSegmentIndex: 0,
          currentQuestionIndex: 0,
        },
        currentInteractionId: null,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        escalatedAt: null,
        version: 1,
        safetyFlag: null,
        outOfScope: false,
        failedAttempts: 0,
      };
      mockGetSessionUseCase.execute.mockResolvedValue(session);

      const response = await request(app).get('/123e4567-e89b-12d3-a456-426614174001');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(session);
    });

    it('should return 404 if session not found', async () => {
      mockGetSessionUseCase.execute.mockResolvedValue(null);
      const response = await request(app).get('/223e4567-e89b-12d3-a456-426614174003');
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid session id format', async () => {
      const response = await request(app).get('/invalid-id');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /', () => {
    it('should list sessions filtered by studentId', async () => {
      const sessions = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          studentId: '223e4567-e89b-12d3-a456-426614174002',
          lessonId: 'lec-1',
          status: 'active',
          stateCheckpoint: {
            currentState: 'ACTIVE_CLASS',
            currentSegmentIndex: 0,
            currentQuestionIndex: 0,
          },
          currentInteractionId: null,
          startedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
          escalatedAt: null,
          version: 1,
          safetyFlag: null,
          outOfScope: false,
          failedAttempts: 0,
        },
      ];
      mockListSessionsUseCase.execute.mockResolvedValue(sessions);

      const response = await request(app).get('/?studentId=223e4567-e89b-12d3-a456-426614174002');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(sessions);
      expect(mockListSessionsUseCase.execute).toHaveBeenCalledWith(
        '223e4567-e89b-12d3-a456-426614174002',
        false,
      );
    });

    it('should respect activeOnly flag', async () => {
      mockListSessionsUseCase.execute.mockResolvedValue([]);
      await request(app).get('/?studentId=223e4567-e89b-12d3-a456-426614174002&activeOnly=true');
      expect(mockListSessionsUseCase.execute).toHaveBeenCalledWith(
        '223e4567-e89b-12d3-a456-426614174002',
        true,
      );
    });

    it('should handle missing studentId', async () => {
      mockListSessionsUseCase.execute.mockResolvedValue([]);
      await request(app).get('/');
      expect(mockListSessionsUseCase.execute).toHaveBeenCalledWith(undefined, false);
    });
  });

  describe('POST /:id/replay', () => {
    it('should reset session and return result', async () => {
      mockResetSessionUseCase.execute.mockResolvedValue({
        message: 'Session reset to segment 1',
        sessionId: '123e4567-e89b-12d3-a456-426614174001',
        resetToSegment: 1,
      });

      const response = await request(app).post('/123e4567-e89b-12d3-a456-426614174001/replay');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Session reset to segment 1',
        sessionId: '123e4567-e89b-12d3-a456-426614174001',
        resetToSegment: 1,
      });
    });

    it('should propagate errors as 500', async () => {
      mockResetSessionUseCase.execute.mockRejectedValue(new Error('Not found'));
      const response = await request(app).post('/unknown/replay');
      expect(response.status).toBe(500);
    });
  });
});
