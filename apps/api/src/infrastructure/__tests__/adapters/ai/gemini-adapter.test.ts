import { GoogleGenerativeAI } from '@google/generative-ai';

import { GeminiAIModelAdapter } from '@/infrastructure/adapters/ai/gemini-adapter';

jest.mock('@google/generative-ai');

describe('GeminiAIModelAdapter', () => {
  let adapter: GeminiAIModelAdapter;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => '{"voiceText": "Mocked response", "pedagogicalState": "EXPLANATION"}',
      },
    });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    }));

    adapter = new GeminiAIModelAdapter('mock-api-key');
  });

  it('should initialize with API key', () => {
    expect(adapter).toBeDefined();
  });

  it('should generate response successfully', async () => {
    const parameters = {
      lesson: {
        id: 'lesson-1',
        title: 'Test Lesson',
        description: 'Test Description',
        concepts: [],
        analogies: [],
        commonErrors: [],
        baseExplanation: 'Test Explanation',
        questions: [],
        chunks: [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentState: 'EXPLANATION' as const,
      conversationHistory: [],
    };

    const result = await adapter.generateResponse(parameters);

    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result.voiceText).toBe('Mocked response');
    expect(result.pedagogicalState).toBe('EXPLANATION');
  });

  it('should handle errors gracefully', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Invalid JSON',
      },
    });

    const parameters = {
      lesson: {
        id: 'lesson-1',
        title: 'Test Lesson',
        description: 'Test Description',
        concepts: [],
        analogies: [],
        commonErrors: [],
        baseExplanation: 'Test Explanation',
        questions: [],
        chunks: [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentState: 'EXPLANATION' as const,
      conversationHistory: [],
    };

    const result = await adapter.generateResponse(parameters);

    expect(result.voiceText).toContain('problema técnico');
    expect(result.pedagogicalState).toBe('QUESTION');
  });
});
