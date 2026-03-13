import { GoogleGenerativeAI } from '@google/generative-ai';

import { GeminiAIModelAdapter } from '@/infrastructure/adapters/ai/gemini/gemini-adapters.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';

jest.mock('@google/generative-ai');

describe('GeminiAIModelAdapter', () => {
  let adapter: GeminiAIModelAdapter;
  let mockGenerateContent: jest.Mock;
  const mockPromptRepo = {} as jest.Mocked<PromptRepository>;

  beforeEach(() => {
    mockGenerateContent = jest.fn();
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    }));
    mockPromptRepo.getPrompt = jest.fn().mockReturnValue('Mocked prompt');
    adapter = new GeminiAIModelAdapter(mockPromptRepo, 'fake-api-key');
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
});
