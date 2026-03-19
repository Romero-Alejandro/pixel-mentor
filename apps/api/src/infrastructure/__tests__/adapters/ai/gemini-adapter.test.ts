import { GoogleGenerativeAI } from '@google/generative-ai';

import { GeminiAIModelAdapter } from '@/infrastructure/adapters/ai/gemini/gemini-adapters.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';
import type pino from 'pino';

jest.mock('@google/generative-ai');

describe('GeminiAIModelAdapter', () => {
  let adapter: GeminiAIModelAdapter;
  let mockGenerateContent: jest.Mock;
  let mockGenerateContentStream: jest.Mock;
  const mockPromptRepo = {} as jest.Mocked<PromptRepository>;
  let mockLogger: jest.Mocked<pino.Logger>;

  beforeEach(() => {
    mockGenerateContent = jest.fn();
    mockGenerateContentStream = jest.fn();
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<pino.Logger>;
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
      }),
    }));
    mockPromptRepo.getPrompt = jest.fn().mockReturnValue('Mocked prompt');
    adapter = new GeminiAIModelAdapter(mockPromptRepo, 'fake-api-key', mockLogger);
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

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(jsonResponse),
      },
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
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Invalid JSON',
      },
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
    it('should yield text chunks in order', async () => {
      const chunks = ['Hello', ' world', '!'];

      const mockStreamResult = {
        stream: (async function* () {
          for (const text of chunks) {
            yield { text: () => text };
          }
        })(),
      };

      mockGenerateContentStream.mockResolvedValue(mockStreamResult);

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
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should skip empty text chunks', async () => {
      const mockStreamResult = {
        stream: (async function* () {
          yield { text: () => 'Hello' };
          yield { text: () => '' };
          yield { text: () => ' world' };
          yield { text: () => '' };
        })(),
      };

      mockGenerateContentStream.mockResolvedValue(mockStreamResult);

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

    it('should log error and re-throw when stream throws', async () => {
      const streamError = new Error('Stream error');
      mockGenerateContentStream.mockRejectedValue(streamError);

      const params = {
        lesson: { title: 'Test Lesson' },
        currentState: 'ACTIVE_CLASS',
        conversationHistory: [],
      };

      await expect(adapter.generateResponseStream(params).next()).rejects.toThrow('Stream error');
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
