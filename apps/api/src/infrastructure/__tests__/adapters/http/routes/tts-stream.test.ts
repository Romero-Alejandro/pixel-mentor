import request from 'supertest';
import * as googleTTS from '@sefinek/google-tts-api';

import { createApp } from '@/infrastructure/adapters/http/server.js';
import { TTSStreamService } from '@/services/ttsStream.js';

// Mock dependencies
vi.mock('@sefinek/google-tts-api', () => ({
  getAllAudioBase64: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/client.js', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/infrastructure/adapters/database/repositories/user-repository.js', () => ({
  PrismaUserRepository: vi.fn().mockImplementation(() => ({
    // mock methods
  })),
}));

vi.mock('@/infrastructure/adapters/database/repositories/recipe-repository.js', () => ({
  PrismaRecipeRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/concept-repository.js', () => ({
  PrismaConceptRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/activity-repository.js', () => ({
  PrismaActivityRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/atom-repository.js', () => ({
  PrismaAtomRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/session-repository.js', () => ({
  PrismaSessionRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/interaction-repository.js', () => ({
  PrismaInteractionRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/knowledge-chunk-repository.js', () => ({
  PrismaKnowledgeChunkRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/progress-repository.js', () => ({
  PrismaProgressRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/event-log-repository.js', () => ({
  PrismaEventLogRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/competency-repository.js', () => ({
  PrismaCompetencyRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/tag-repository.js', () => ({
  PrismaTagRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/recipe-tag-repository.js', () => ({
  PrismaRecipeTagRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/competency-mastery-repository.js', () => ({
  PrismaCompetencyMasteryRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/database/repositories/advisory-lock.js', () => ({
  PostgresAdvisoryLockManager: {
    getInstance: vi.fn().mockReturnValue({
      // mock lock methods
    }),
  },
}));

vi.mock('@/infrastructure/adapters/ai/ai-adapter-factory.js', () => ({
  AIAdapterFactory: {
    create: vi.fn().mockReturnValue({
      // mock AI service
    }),
  },
}));

vi.mock('@/infrastructure/adapters/prompts/file-system-prompt-repository.js', () => ({
  FileSystemPromptRepository: vi.fn(),
}));

vi.mock('@/infrastructure/adapters/tts/tts-factory.js', () => ({
  TTSProviderFactory: {
    create: vi.fn().mockReturnValue({
      speak: vi.fn().mockResolvedValue({
        audioContentBase64: 'mocked-audio-base64',
        voice: { name: 'test' },
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      listVoices: vi.fn().mockResolvedValue([]),
    }),
  },
}));

import type { Request, Response } from 'express';

describe('TTS SSE Stream Endpoint', () => {
  let server: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock request handler
    (googleTTS.getAllAudioBase64 as ReturnType<typeof vi.fn>).mockResolvedValue([
      { base64: 'chunk1' },
      { base64: 'chunk2' },
    ]);

    // Create app
    server = await createApp({
      config: {
        NODE_ENV: 'test',
        PORT: 0,
        CORS_ORIGIN: '*',
        LOG_LEVEL: 'info',
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
        RATE_LIMIT_MAX_INTERACT: 10,
        REQUEST_TIMEOUT_MS: 30000,
        JWT_SECRET: 'test-secret',
      },
      logger: { info: vi.fn(), error: vi.fn(), fatal: vi.fn() } as any,
      prisma: { $connect: vi.fn(), $queryRaw: vi.fn() } as any,
      userRepo: { validateToken: vi.fn() } as any,
      orchestrateUseCase: {} as any,
      getRecipeUseCase: {} as any,
      listRecipesUseCase: {} as any,
      getSessionUseCase: {} as any,
      listSessionsUseCase: {} as any,
      resetSessionUseCase: {} as any,
      completeSessionUseCase: {} as any,
      registerUseCase: {} as any,
      loginUseCase: {} as any,
      verifyTokenUseCase: { verifyToken: vi.fn().mockResolvedValue({ id: 'user-123' }) } as any,
      questionAnsweringUseCase: {} as any,
      ttsService: {
        speak: vi.fn().mockResolvedValue({
          audioContentBase64: 'mocked-audio',
          voice: { name: 'test' },
        }),
      } as any,
    });
  });

  describe('GET /api/tts/stream', () => {
    it('should return SSE stream with correct headers', async () => {
      const response = await request(server).get('/api/tts/stream').query({
        text: 'Hello world',
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should stream audio chunks as SSE events', async () => {
      const response = await request(server)
        .get('/api/tts/stream')
        .query({ text: 'Hello world' })
        .buffer(true);

      expect(response.status).toBe(200);

      const body = response.text;
      // Should contain audio events
      expect(body).toContain('event: audio');
      expect(body).toContain('data:');
      expect(body).toContain('chunk1');
      expect(body).toContain('chunk2');
      // Should contain end event
      expect(body).toContain('event: end');
    });

    it('should validate missing text parameter', async () => {
      const response = await request(server).get('/api/tts/stream');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Text query parameter is required');
    });

    it('should sanitize text and handle empty result', async () => {
      // Test with only HTML tags (which get stripped)
      const response = await request(server).get('/api/tts/stream').query({
        text: '<script>alert("xss")</script>',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Text cannot be empty after sanitization');
    });

    it('should handle streaming errors gracefully', async () => {
      (googleTTS.getAllAudioBase64 as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('TTS service down'),
      );

      const response = await request(server)
        .get('/api/tts/stream')
        .query({ text: 'Hello world' })
        .buffer(true);

      expect(response.status).toBe(200); // Still 200 because SSE connection established

      const body = response.text;
      // Should contain error event
      expect(body).toContain('event: error');
      expect(body).toContain('TTS service down');
    });
  });
});
