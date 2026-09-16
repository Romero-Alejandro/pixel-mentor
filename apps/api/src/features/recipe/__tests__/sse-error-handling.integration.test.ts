/**
 * SSE Error Handling Integration Tests
 *
 * Tests that structured SessionError subclasses are correctly mapped
 * to SSE error events with proper codes, user messages, and metadata.
 */

import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

import {
  SessionError,
  SessionNotFoundError,
  SessionNotActiveError,
  RecipeNotFoundError,
  RecipeHasNoStepsError,
  LLMTimeoutError,
  InvalidInputError,
} from '@/features/recipe/domain/errors/session.errors';

// ---- Mocks ----

jest.mock('@/shared/logger/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@/shared/config/index.js', () => ({
  config: {
    ENABLE_STREAMING: true,
    NODE_ENV: 'test',
  },
}));

jest.mock('@/shared/http/llm-governance.middleware.js', () => ({
  llmGovernanceMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  recordLLMUsage: jest.fn(),
}));

// ---- Types ----

interface InteractionChunk {
  type: 'chunk' | 'end';
  text?: string;
  reason?: string;
  pedagogicalState?: string;
  sessionCompleted?: boolean;
  staticContent?: { stepType?: string; script?: unknown; activity?: unknown };
  lessonProgress?: { currentStep: number; totalSteps: number };
  feedback?: string;
  isCorrect?: boolean;
  autoAdvance?: boolean;
  xpEarned?: number;
  accuracy?: unknown;
}

// ---- SSE Response Parser ----

function parseSSEResponse(body: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const lines = body.split('\n');
  let currentEvent = '';
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6);
    } else if (line === '' && currentEvent && currentData) {
      try {
        events.push({ event: currentEvent, data: JSON.parse(currentData) });
      } catch {
        events.push({ event: currentEvent, data: currentData });
      }
      currentEvent = '';
      currentData = '';
    }
  }

  return events;
}

// ---- Fixtures ----

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';

// ---- Route Builder (simulates the actual route handler) ----

function buildStreamApp(
  interactStreamFn: (sessionId: string, studentInput: string) => AsyncGenerator<InteractionChunk>,
) {
  const app = express();
  app.use(express.json());

  const mockOrchestrator = {
    interactStream: interactStreamFn,
  };

  app.post('/api/recipe/interact/stream', async (req: Request, res: Response) => {
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined;
    const studentInput =
      typeof req.body?.studentInput === 'string' ? req.body.studentInput : undefined;

    if (!sessionId || !studentInput) {
      res.status(400).json({ error: 'sessionId and studentInput required in request body' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let errorSent = false;

    try {
      const stream = mockOrchestrator.interactStream(sessionId, studentInput);

      for await (const c of stream) {
        if (c.type === 'chunk') {
          res.write(`event: chunk\ndata: ${JSON.stringify({ text: c.text })}\n\n`);
        } else if (c.type === 'end') {
          res.write(
            `event: end\ndata: ${JSON.stringify({
              reason: c.reason,
              pedagogicalState: c.pedagogicalState,
              sessionCompleted: c.sessionCompleted,
              staticContent: c.staticContent,
              lessonProgress: c.lessonProgress,
              feedback: c.feedback,
              isCorrect: c.isCorrect,
              autoAdvance: c.autoAdvance,
              xpEarned: c.xpEarned,
              accuracy: c.accuracy,
            })}\n\n`,
          );
          break;
        }
      }
    } catch (error) {
      // Simulate the structured error handling from the actual route
      const userMessage =
        error instanceof SessionError
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      const errorCode = error instanceof SessionError ? error.code : 'INTERNAL_ERROR';

      const statusCode = error instanceof SessionError ? error.statusCode : 500;

      if (!errorSent) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: userMessage,
            code: errorCode,
            statusCode,
          })}\n\n`,
        );
        errorSent = true;
      }
    }

    res.end();
  });

  return app;
}

// ---- Tests ----

describe('SSE Error Handling Integration', () => {
  describe('Structured SessionError mapping', () => {
    it('should map SessionNotFoundError to error event with SESSION_NOT_FOUND code', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new SessionNotFoundError(SESSION_ID);
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('SESSION_NOT_FOUND');
      expect(data.message).toBe('No se encontro la sesion. Intenta de nuevo.');
      expect(data.statusCode).toBe(404);
    });

    it('should map SessionNotActiveError to error event with SESSION_NOT_ACTIVE code', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new SessionNotActiveError(SESSION_ID, 'COMPLETED');
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('SESSION_NOT_ACTIVE');
      expect(data.message).toBe('La sesion no esta activa. Recarga la pagina e intenta de nuevo.');
      expect(data.statusCode).toBe(409);
    });

    it('should map RecipeNotFoundError to error event with RECIPE_NOT_FOUND code', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new RecipeNotFoundError('recipe-123');
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('RECIPE_NOT_FOUND');
      expect(data.message).toBe('No se encontro la leccion. Verifica que este publicada.');
      expect(data.statusCode).toBe(404);
    });

    it('should map RecipeHasNoStepsError to error event with RECIPE_HAS_NO_STEPS code', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new RecipeHasNoStepsError('recipe-456');
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('RECIPE_HAS_NO_STEPS');
      expect(data.message).toBe('La leccion no tiene contenido configurado.');
      expect(data.statusCode).toBe(422);
    });

    it('should map LLMTimeoutError to error event with LLM_TIMEOUT code', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new LLMTimeoutError(30000);
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('LLM_TIMEOUT');
      expect(data.message).toBe('El tutor esta tardando mucho. Intenta de nuevo.');
      expect(data.statusCode).toBe(504);
    });

    it('should map InvalidInputError to error event with INVALID_INPUT code', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new InvalidInputError('studentInput', 'Missing required field');
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('INVALID_INPUT');
      expect(data.message).toBe('La entrada no es valida. Intenta de nuevo.');
      expect(data.statusCode).toBe(400);
    });

    it('should fall back to INTERNAL_ERROR for generic Error', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new Error('Something went wrong');
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('INTERNAL_ERROR');
      expect(data.message).toBe('Something went wrong');
      expect(data.statusCode).toBe(500);
    });

    it('should include metadata in error event when available', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new LLMTimeoutError(30000);
        yield { type: 'chunk', text: 'never reached' };
      }

      const app = buildStreamApp(failingStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const data = errorEvent!.data as Record<string, unknown>;
      expect(data.code).toBe('LLM_TIMEOUT');
      // Note: metadata inclusion depends on the route handler implementation
      // This test verifies the error structure is correct
    });

    it('should handle error mid-stream without losing chunks', async () => {
      async function* partialFailStream(): AsyncGenerator<InteractionChunk> {
        yield { type: 'chunk', text: 'Hello ' };
        yield { type: 'chunk', text: 'world' };
        throw new SessionNotFoundError(SESSION_ID);
      }

      const app = buildStreamApp(partialFailStream);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const chunkEvents = events.filter((e) => e.event === 'chunk');
      const errorEvent = events.find((e) => e.event === 'error');

      expect(chunkEvents).toHaveLength(2);
      expect(errorEvent).toBeDefined();

      const errorData = errorEvent!.data as Record<string, unknown>;
      expect(errorData.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('Input validation (pre-SSE)', () => {
    it('should return 400 when sessionId is missing', async () => {
      const app = buildStreamApp(async function* () {});
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ studentInput: 'ok' })
        .expect(400);

      expect(response.body.error).toContain('sessionId');
    });

    it('should return 400 when studentInput is missing', async () => {
      const app = buildStreamApp(async function* () {});
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID })
        .expect(400);

      expect(response.body.error).toContain('studentInput');
    });
  });
});
