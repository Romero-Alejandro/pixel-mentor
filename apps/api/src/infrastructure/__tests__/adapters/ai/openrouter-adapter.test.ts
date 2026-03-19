jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

jest.mock('@/config/index.js', () => ({
  config: {
    DEFAULT_MODEL_OPENROUTER: 'stepfun/step-3.5-flash',
  },
}));

import OpenAI from 'openai';

import { OpenRouterAdapter } from '@/infrastructure/adapters/ai/open-router/openrouter-adapters.js';
import type pino from 'pino';

describe('OpenRouterAdapter', () => {
  let adapter: OpenRouterAdapter;
  let mockCreate: jest.Mock;
  const mockPromptRepo = { getPrompt: jest.fn().mockReturnValue('Mocked prompt') };
  let mockLogger: jest.Mocked<pino.Logger>;

  beforeEach(() => {
    mockCreate = jest.fn();
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<pino.Logger>;
    (OpenAI as any).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
    adapter = new OpenRouterAdapter(mockPromptRepo, 'fake-api-key', mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize', () => {
    expect(adapter).toBeDefined();
  });

  it('should generate structured response successfully', async () => {
    const jsonResponse = {
      explanation: 'This is an explanation',
      supportQuotes: ['Quote 1', 'Quote 2'],
      verificationQuestion: 'What is 2+2?',
      microInteraction: { type: 'HOOK', text: 'Ready for more?' },
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(jsonResponse) } }],
    });

    const params = {
      lesson: { title: 'Test Lesson' },
      currentState: 'ACTIVE_CLASS',
      conversationHistory: [],
    };

    const result = await adapter.generateResponse(params);

    expect(result.explanation).toBe('This is an explanation');
    expect(result.supportQuotes).toEqual(['Quote 1', 'Quote 2']);
    expect(result.verificationQuestion).toBe('What is 2+2?');
    expect(result.microInteraction).toEqual({ type: 'HOOK', text: 'Ready for more?' });
    expect(result.pedagogicalState).toBe('ACTIVE_CLASS');
  });

  it('should handle invalid JSON gracefully', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Invalid JSON' } }],
    });

    const params = {
      lesson: { title: 'Test Lesson' },
      currentState: 'EXPLANATION',
      conversationHistory: [],
    };

    const result = await adapter.generateResponse(params);

    expect(result.explanation).toBe('Tuve un problema técnico, ¿puedes intentarlo de nuevo?');
    expect(result.supportQuotes).toEqual([]);
    expect(result.pedagogicalState).toBe('EXPLANATION');
  });

  describe('generateResponseStream', () => {
    it('should yield correct text sequence', async () => {
      const chunks = ['Hello', ' world', '!'];

      const mockStream = (async function* () {
        for (const text of chunks) {
          yield { choices: [{ delta: { content: text } }] };
        }
      })();

      mockCreate.mockResolvedValue(mockStream);

      const params = {
        lesson: { title: 'Test Lesson' },
        currentState: 'ACTIVE_CLASS',
        conversationHistory: [],
      };

      const result: string[] = [];
      for await (const chunk of adapter.generateResponseStream(params)) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' world', '!']);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'stepfun/step-3.5-flash',
          stream: true,
        }),
      );
    });

    it('should skip empty content chunks', async () => {
      const mockStream = (async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: '' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
        yield { choices: [{ delta: {} }] }; // no content field
        yield { choices: [{}] }; // empty delta
        yield { choices: [] }; // empty choices
      })();

      mockCreate.mockResolvedValue(mockStream);

      const params = {
        lesson: { title: 'Test Lesson' },
        currentState: 'EXPLANATION',
        conversationHistory: [],
      };

      const result: string[] = [];
      for await (const chunk of adapter.generateResponseStream(params)) {
        result.push(chunk);
      }

      expect(result).toEqual(['Hello', ' world']);
    });

    it('should propagate error from stream', async () => {
      const streamError = new Error('OpenRouter stream error');
      mockCreate.mockRejectedValue(streamError);

      const params = {
        lesson: { title: 'Test Lesson' },
        currentState: 'ACTIVE_CLASS',
        conversationHistory: [],
      };

      await expect(adapter.generateResponseStream(params).next()).rejects.toThrow(
        'OpenRouter stream error',
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LLM streaming error',
          state: 'ACTIVE_CLASS',
          error: streamError,
        }),
      );
    });
  });
});
