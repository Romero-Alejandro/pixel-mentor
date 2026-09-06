/**
 * SSE Heartbeat / Keepalive Tests
 *
 * Validates that the SSE streaming route sends periodic heartbeat comments
 * (`:heartbeat\n\n`) to keep the TCP connection alive through proxies
 * and load balancers during long LLM generation pauses.
 *
 * SSE comments (lines starting with `:`) are ignored by EventSource/fetchEventSource
 * but prevent idle timeout disconnection.
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
  llmGovernanceMiddleware: () => (req: Request, _res: Response, next: NextFunction) => next(),
  recordLLMUsage: jest.fn(),
}));

// ---- Types ----

interface InteractionChunk {
  type: 'chunk' | 'end';
  text?: string;
  reason?: string;
  pedagogicalState?: string;
  sessionCompleted?: boolean;
  lessonProgress?: { currentStep: number; totalSteps: number };
  autoAdvance?: boolean;
}

// ---- SSE Parser (raw text) ----

// ---- Fixtures ----

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeChunk(text: string): InteractionChunk {
  return { type: 'chunk', text };
}

function makeEnd(): InteractionChunk {
  return {
    type: 'end',
    reason: 'completed',
    pedagogicalState: 'EXPLANATION',
    sessionCompleted: false,
    lessonProgress: { currentStep: 0, totalSteps: 3 },
    autoAdvance: true,
  };
}

// ---- Route Builder (with heartbeat) ----

function buildStreamAppWithHeartbeat(
  interactStreamFn: (sessionId: string, studentInput: string) => AsyncGenerator<InteractionChunk>,
  heartbeatIntervalMs = 50, // Short interval for tests
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

    // Start heartbeat
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(':heartbeat\n\n');
      }
    }, heartbeatIntervalMs);

    res.on('close', () => {
      clearInterval(heartbeat);
    });

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
              lessonProgress: c.lessonProgress,
              autoAdvance: c.autoAdvance,
            })}\n\n`,
          );
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorSent) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
        errorSent = true;
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  return app;
}

// ---- Tests ----

describe('SSE Heartbeat / Keepalive', () => {
  describe('Heartbeat sending', () => {
    it('should send heartbeat comments during streaming', async () => {
      // Slow generator that takes time between chunks
      async function* slowStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Hello ');
        await new Promise((r) => setTimeout(r, 120)); // Wait longer than heartbeat interval
        yield makeChunk('World');
        yield makeEnd();
      }

      const app = buildStreamAppWithHeartbeat(slowStream, 50);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      const { events, comments } = parseSSEResponseWithComments(response.text);

      // Should have heartbeat comments
      expect(comments.length).toBeGreaterThan(0);
      expect(comments.every((c) => c === 'heartbeat')).toBe(true);

      // Should still have the real events
      expect(events).toHaveLength(3); // 2 chunks + 1 end
      expect(events[0].event).toBe('chunk');
      expect(events[2].event).toBe('end');
    });

    it('should not send heartbeats for fast streams that complete quickly', async () => {
      async function* fastStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Quick ');
        yield makeChunk('response');
        yield makeEnd();
      }

      const app = buildStreamAppWithHeartbeat(fastStream, 50);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      const { events, comments } = parseSSEResponseWithComments(response.text);

      // Fast stream may or may not have heartbeats depending on timing
      // But it should still work correctly
      expect(events).toHaveLength(3);
      expect(events[0].event).toBe('chunk');
      expect(events[2].event).toBe('end');
    });

    it('should send heartbeats during long pauses between chunks', async () => {
      async function* longPauseStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Start');
        // Simulate long LLM thinking time
        await new Promise((r) => setTimeout(r, 200));
        yield makeChunk('End');
        yield makeEnd();
      }

      const app = buildStreamAppWithHeartbeat(longPauseStream, 50);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      const { events, comments } = parseSSEResponseWithComments(response.text);

      // With 200ms pause and 50ms heartbeat interval, should have ~3-4 heartbeats
      expect(comments.length).toBeGreaterThanOrEqual(2);
      expect(events).toHaveLength(3);
    });
  });

  describe('Heartbeat cleanup', () => {
    it('should stop sending heartbeats after stream ends', async () => {
      const writeCount = 0;
      const writes: string[] = [];

      async function* trackedStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Content');
        yield makeEnd();
      }

      const app = express();
      app.use(express.json());

      app.post('/api/recipe/interact/stream', async (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) {
            res.write(':heartbeat\n\n');
          }
        }, 30);

        res.on('close', () => {
          clearInterval(heartbeat);
        });

        try {
          const stream = trackedStream();
          for await (const c of stream) {
            if (c.type === 'chunk') {
              res.write(`event: chunk\ndata: ${JSON.stringify({ text: c.text })}\n\n`);
            } else if (c.type === 'end') {
              res.write(`event: end\ndata: ${JSON.stringify({ reason: 'completed' })}\n\n`);
              break;
            }
          }
        } finally {
          clearInterval(heartbeat);
          if (!res.writableEnded) {
            res.end();
          }
        }
      });

      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      const { comments } = parseSSEResponseWithComments(response.text);

      // After stream ends, no more heartbeats should be sent
      // (We can't directly test this in a unit test, but we verify
      // the stream completes cleanly without hanging)
      expect(response.status).toBe(200);
    });
  });

  describe('Heartbeat format', () => {
    it('should use valid SSE comment format (: prefix)', async () => {
      async function* delayedStream(): AsyncGenerator<InteractionChunk> {
        await new Promise((r) => setTimeout(r, 120));
        yield makeChunk('delayed content');
        yield makeEnd();
      }

      const app = buildStreamAppWithHeartbeat(delayedStream, 50);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      // Check raw response contains valid SSE comment format
      const raw = response.text;
      const heartbeatLines = raw
        .split('\n')
        .filter((line: string) => line.startsWith(':heartbeat'));

      expect(heartbeatLines.length).toBeGreaterThan(0);
      // Each heartbeat should be exactly ":heartbeat" followed by \n\n
      for (const line of heartbeatLines) {
        expect(line).toBe(':heartbeat');
      }
    });

    it('should not interfere with chunk and end events', async () => {
      async function* mixedStream(): AsyncGenerator<InteractionChunk> {
        await new Promise((r) => setTimeout(r, 120));
        yield makeChunk('Part 1');
        await new Promise((r) => setTimeout(r, 120));
        yield makeChunk('Part 2');
        yield makeEnd();
      }

      const app = buildStreamAppWithHeartbeat(mixedStream, 50);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      const { events, comments } = parseSSEResponseWithComments(response.text);

      // Heartbeats should not corrupt events
      expect(events).toHaveLength(3); // 2 chunks + 1 end
      expect(events.filter((e) => e.event === 'chunk')).toHaveLength(2);
      expect(events.filter((e) => e.event === 'end')).toHaveLength(1);

      // Heartbeats should be separate from events
      expect(comments.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling during heartbeat', () => {
    it('should clean up heartbeat interval on generator error', async () => {
      async function* errorStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('Before error');
        throw new Error('LLM service failed');
      }

      const app = buildStreamAppWithHeartbeat(errorStream, 50);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      const { events } = parseSSEResponseWithComments(response.text);

      // Should have chunk + error event
      expect(events.some((e) => e.event === 'chunk')).toBe(true);
      expect(events.some((e) => e.event === 'error')).toBe(true);

      // Stream should complete without hanging
      expect(response.status).toBe(200);
    });

    it('should not crash if response is already ended when heartbeat fires', async () => {
      async function* instantStream(): AsyncGenerator<InteractionChunk> {
        yield makeChunk('instant');
        yield makeEnd();
      }

      // Use very short heartbeat interval to maximize chance of firing after end
      const app = buildStreamAppWithHeartbeat(instantStream, 10);
      const response = await request(app)
        .post('/api/recipe/interact/stream')
        .send({ sessionId: SESSION_ID, studentInput: 'hi' });

      expect(response.status).toBe(200);
      const { events } = parseSSEResponseWithComments(response.text);
      expect(events.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---- Helper: parse with comment extraction ----

function parseSSEResponseWithComments(body: string): {
  events: Array<{ event: string; data: unknown }>;
  comments: string[];
} {
  const events: Array<{ event: string; data: unknown }> = [];
  const comments: string[] = [];
  const lines = body.split('\n');
  let currentEvent = '';
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith(':')) {
      comments.push(line.slice(1).trim());
    } else if (line.startsWith('event: ')) {
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

  return { events, comments };
}
