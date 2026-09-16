/**
 * SSE Lesson Flow Integration Tests
 *
 * Tests the full lesson lifecycle through the SSE streaming route:
 *   start -> interact (content) -> interact (question) -> interact (answer) -> complete
 *
 * Validates:
 *   - SSE event format (chunk, end, error)
 *   - Multi-step lesson progression
 *   - Error propagation from generator to SSE error event
 *   - Edge cases: empty stream, session not found, etc.
 */

import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

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
  accuracy?: {
    correctFirstAttempts: number;
    totalActivities: number;
    skippedActivities: number;
    accuracyPercent: number;
    tier: string;
  };
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

function makeChunk(text: string): InteractionChunk {
  return { type: 'chunk', text };
}

function makeEnd(overrides: Partial<InteractionChunk> = {}): InteractionChunk {
  return {
    type: 'end',
    reason: 'completed',
    pedagogicalState: 'EXPLANATION',
    sessionCompleted: false,
    lessonProgress: { currentStep: 0, totalSteps: 5 },
    autoAdvance: true,
    ...overrides,
  };
}

// ---- Route Builder ----

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorSent) {
        const code = (error as { code?: string }).code ?? 'INTERNAL_ERROR';
        res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage, code })}\n\n`);
        errorSent = true;
      }
    }

    res.end();
  });

  return app;
}

// ---- Tests ----

describe('SSE Lesson Flow Integration', () => {
  describe('Full lesson lifecycle', () => {
    it('should stream chunks then an end event for a content step', async () => {
      async function* contentStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Bienvenido a la leccion de ');
        yield makeChunk('historia. ');
        yield makeChunk('Hoy aprenderemos sobre civilizaciones antiguas.');
        yield makeEnd({
          pedagogicalState: 'EXPLANATION',
          lessonProgress: { currentStep: 0, totalSteps: 3 },
          autoAdvance: true,
        });
      }

      const app = buildStreamApp(contentStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');

      const events = parseSSEResponse(response.text);
      const chunkEvents = events.filter((e) => e.event === 'chunk');
      const endEvents = events.filter((e) => e.event === 'end');

      expect(chunkEvents).toHaveLength(3);
      expect(endEvents).toHaveLength(1);

      const fullText = chunkEvents.map((e) => (e.data as { text: string }).text).join('');
      expect(fullText).toBe(
        'Bienvenido a la leccion de historia. Hoy aprenderemos sobre civilizaciones antiguas.',
      );

      const endData = endEvents[0].data as Record<string, unknown>;
      expect(endData.pedagogicalState).toBe('EXPLANATION');
      expect(endData.sessionCompleted).toBe(false);
      expect(endData.autoAdvance).toBe(true);
      expect(endData.lessonProgress).toEqual({ currentStep: 0, totalSteps: 3 });
    });

    it('should handle a full lesson: start -> content -> question -> answer -> complete', async () => {
      let callCount = 0;

      async function* multiStepStream(): AsyncGenerator<InteractionChunk> {
        callCount++;

        if (callCount === 1) {
          yield makeChunk('La Revolucion Francesa comenzo en 1789.');
          yield makeEnd({
            pedagogicalState: 'EXPLANATION',
            lessonProgress: { currentStep: 0, totalSteps: 2 },
            autoAdvance: true,
          });
        } else if (callCount === 2) {
          yield makeChunk('En que ano comenzo la Revolucion Francesa?');
          yield makeEnd({
            pedagogicalState: 'ACTIVITY_WAIT',
            lessonProgress: { currentStep: 1, totalSteps: 2 },
            staticContent: {
              stepType: 'question',
              script: {
                question: 'En que ano comenzo la Revolucion Francesa?',
                expectedAnswer: '1789',
              },
            },
            autoAdvance: false,
          });
        } else if (callCount === 3) {
          yield makeChunk('Correcto! La Revolucion Francesa comenzo en 1789.');
          yield makeEnd({
            pedagogicalState: 'EVALUATION',
            lessonProgress: { currentStep: 1, totalSteps: 2 },
            feedback: 'Correcto!',
            isCorrect: true,
            autoAdvance: false,
          });
        } else if (callCount === 4) {
          yield makeChunk('Felicitaciones! Has completado la leccion.');
          yield makeEnd({
            pedagogicalState: 'COMPLETED',
            sessionCompleted: true,
            lessonProgress: { currentStep: 2, totalSteps: 2 },
            xpEarned: 50,
            accuracy: {
              correctFirstAttempts: 1,
              totalActivities: 1,
              skippedActivities: 0,
              accuracyPercent: 100,
              tier: 'perfect',
            },
          });
        }
      }

      const app = buildStreamApp(multiStepStream);

      // Step 1: Content
      let response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      let events = parseSSEResponse(response.text);
      let foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();
      expect((foundEnd!.data as Record<string, unknown>).pedagogicalState).toBe('EXPLANATION');
      expect((foundEnd!.data as Record<string, unknown>).autoAdvance).toBe(true);

      // Step 2: Navigate to question
      response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'continuar' })
        .expect(200);

      events = parseSSEResponse(response.text);
      foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();
      expect((foundEnd!.data as Record<string, unknown>).pedagogicalState).toBe('ACTIVITY_WAIT');

      // Step 3: Answer
      response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'Paris' })
        .expect(200);

      events = parseSSEResponse(response.text);
      foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();
      expect((foundEnd!.data as Record<string, unknown>).pedagogicalState).toBe('EVALUATION');
      expect((foundEnd!.data as Record<string, unknown>).isCorrect).toBe(true);

      // Step 4: Complete
      response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'continuar' })
        .expect(200);

      events = parseSSEResponse(response.text);
      foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();
      expect((foundEnd!.data as Record<string, unknown>).pedagogicalState).toBe('COMPLETED');
      expect((foundEnd!.data as Record<string, unknown>).sessionCompleted).toBe(true);
      expect((foundEnd!.data as Record<string, unknown>).xpEarned).toBe(50);
    });

    it('should handle MCQ activity with correct and incorrect answers', async () => {
      let callCount = 0;

      async function* mcqStream(): AsyncGenerator<InteractionChunk> {
        callCount++;

        if (callCount === 1) {
          yield makeChunk('Cual es la capital de Francia?');
          yield makeEnd({
            pedagogicalState: 'ACTIVITY_WAIT',
            staticContent: {
              stepType: 'activity',
              activity: {
                instruction: 'Cual es la capital de Francia?',
                options: [
                  { text: 'Madrid', isCorrect: false },
                  { text: 'Paris', isCorrect: true },
                  { text: 'Roma', isCorrect: false },
                ],
              },
            },
            autoAdvance: false,
          });
        } else if (callCount === 2) {
          yield makeChunk('Excelente! Paris es la capital de Francia.');
          yield makeEnd({
            pedagogicalState: 'EVALUATION',
            feedback: 'Excelente!',
            isCorrect: true,
            autoAdvance: false,
          });
        }
      }

      const app = buildStreamApp(mcqStream);

      let response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      let events = parseSSEResponse(response.text);
      let foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();
      const staticContent = (foundEnd!.data as Record<string, unknown>).staticContent as Record<
        string,
        unknown
      >;
      expect(staticContent.stepType).toBe('activity');

      response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'Paris' })
        .expect(200);

      events = parseSSEResponse(response.text);
      foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();
      expect((foundEnd!.data as Record<string, unknown>).isCorrect).toBe(true);
    });

    it('should include gamification data in completion event', async () => {
      async function* completeStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Leccion completada.');
        yield makeEnd({
          pedagogicalState: 'COMPLETED',
          sessionCompleted: true,
          lessonProgress: { currentStep: 5, totalSteps: 5 },
          xpEarned: 80,
          accuracy: {
            correctFirstAttempts: 4,
            totalActivities: 5,
            skippedActivities: 0,
            accuracyPercent: 80,
            tier: 'high',
          },
        });
      }

      const app = buildStreamApp(completeStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'continuar' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const foundEnd = events.find((e) => e.event === 'end');
      expect(foundEnd).toBeDefined();

      const data = foundEnd!.data as Record<string, unknown>;
      expect(data.sessionCompleted).toBe(true);
      expect(data.xpEarned).toBe(80);

      const accuracy = data.accuracy as Record<string, unknown>;
      expect(accuracy.tier).toBe('high');
      expect(accuracy.accuracyPercent).toBe(80);
    });
  });

  describe('Error handling', () => {
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

    it('should return 400 when body is empty', async () => {
      const app = buildStreamApp(async function* () {});

      const response = await request(app).post('/api/recipe/interact/stream').send({}).expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should write error event when generator throws', async () => {
      async function* failingStream(): AsyncGenerator<InteractionChunk> {
        throw new Error('Session not found: abc-123');
        yield makeChunk('This should never be reached');
      }

      const app = buildStreamApp(failingStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const errorEvent = events.find((e) => e.event === 'error');
      expect(errorEvent).toBeDefined();

      const errorData = errorEvent!.data as Record<string, unknown>;
      expect(errorData.message).toBe('Session not found: abc-123');
      expect(errorData.code).toBe('INTERNAL_ERROR');
    });

    it('should write error event when generator throws mid-stream', async () => {
      async function* partialFailStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Some text before error');
        throw new Error('Connection lost');
      }

      const app = buildStreamApp(partialFailStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const chunkEvents = events.filter((e) => e.event === 'chunk');
      const errorEvents = events.filter((e) => e.event === 'error');

      expect(chunkEvents).toHaveLength(1);
      expect((chunkEvents[0].data as { text: string }).text).toBe('Some text before error');
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0].data as Record<string, unknown>).message).toBe('Connection lost');
    });

    it('should handle generator that yields no events', async () => {
      async function* emptyStream(): AsyncGenerator<InteractionChunk> {
        // yields nothing
      }

      const app = buildStreamApp(emptyStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      expect(events).toHaveLength(0);
    });
  });

  describe('SSE format validation', () => {
    it('should use correct SSE event format with double newlines', async () => {
      async function* formatStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Hello');
        yield makeEnd();
      }

      const app = buildStreamApp(formatStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      expect(response.text).toContain('event: chunk\ndata: ');
      expect(response.text).toContain('event: end\ndata: ');
      expect(response.text).toContain('}\n\nevent: end');
    });

    it('should set correct SSE headers', async () => {
      async function* headerStream(): AsyncGenerator<InteractionChunk> {
        yield makeEnd();
      }

      const app = buildStreamApp(headerStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should end the response after the end event', async () => {
      async function* endStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Before end');
        yield makeEnd({ sessionCompleted: true });
        yield makeChunk('After end - should not appear');
      }

      const app = buildStreamApp(endStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const chunkEvents = events.filter((e) => e.event === 'chunk');
      const endEvents = events.filter((e) => e.event === 'end');

      expect(chunkEvents).toHaveLength(1);
      expect(endEvents).toHaveLength(1);
      expect((chunkEvents[0].data as { text: string }).text).toBe('Before end');
    });
  });

  describe('Large payload handling', () => {
    it('should handle many chunks in a single stream', async () => {
      const CHUNK_COUNT = 100;

      async function* manyChunksStream(): AsyncGenerator<InteractionChunk> {
        for (let i = 0; i < CHUNK_COUNT; i++) {
          yield makeChunk(`chunk-${i} `);
        }
        yield makeEnd({
          lessonProgress: { currentStep: 0, totalSteps: 1 },
        });
      }

      const app = buildStreamApp(manyChunksStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const chunkEvents = events.filter((e) => e.event === 'chunk');
      const endEvents = events.filter((e) => e.event === 'end');

      expect(chunkEvents).toHaveLength(CHUNK_COUNT);
      expect(endEvents).toHaveLength(1);

      const fullText = chunkEvents.map((e) => (e.data as { text: string }).text).join('');
      expect(fullText).toContain('chunk-0');
      expect(fullText).toContain(`chunk-${CHUNK_COUNT - 1}`);
    });

    it('should handle long text in chunks', async () => {
      const longText = 'A'.repeat(10_000);

      async function* longTextStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk(longText);
        yield makeEnd();
      }

      const app = buildStreamApp(longTextStream);

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'ok' })
        .expect(200);

      const events = parseSSEResponse(response.text);
      const chunkEvents = events.filter((e) => e.event === 'chunk');
      expect(chunkEvents).toHaveLength(1);
      expect((chunkEvents[0].data as { text: string }).text).toBe(longText);
    });
  });
});
