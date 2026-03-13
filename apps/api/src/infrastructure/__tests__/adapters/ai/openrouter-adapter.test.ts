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

import OpenAI from 'openai';

import { OpenRouterAdapter } from '@/infrastructure/adapters/ai/open-router/openrouter-adapters.js';

describe('OpenRouterAdapter', () => {
  let adapter: OpenRouterAdapter;
  let mockCreate: jest.Mock;
  const mockPromptRepo = { getPrompt: jest.fn().mockReturnValue('Mocked prompt') };

  beforeEach(() => {
    mockCreate = (OpenAI as any).mock.calls[0]?.result?.chat.completions.create || jest.fn();
    // Need to get the mock instance's method. Actually, OpenAI mock returns a new object each time. We can instead set up mockImplementation to return object with create mock accessible.
    // Simpler: after adapter is constructed, we can get the client from the adapter's private? Not possible.
    // Instead, we mock OpenAI such that the returned object has a jest.fn for create that we can track.
    // We'll restructure: define mockCreate as jest.fn() and have OpenAI mock implementation return an object containing that mock.
    // So reset and reconfigure before each.
    mockCreate = jest.fn();
    (OpenAI as any).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
    adapter = new OpenRouterAdapter(mockPromptRepo, 'fake-api-key');
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
});
