import { ContextWindowService } from '@/application/services/context-window.service.js';
import type { Interaction } from '@/domain/entities/interaction.js';

describe('ContextWindowService', () => {
  let service: ContextWindowService;

  beforeEach(() => {
    service = new ContextWindowService({ maxTokens: 100, keepRecentTurns: 4 });
  });

  const createInteraction = (turnNumber: number, transcript: string): Interaction =>
    ({
      id: `interaction-${turnNumber}`,
      sessionId: 'session-1',
      turnNumber,
      transcript,
      aiResponse: null,
      pausedForQuestion: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any;

  it('should trim history to keep recent turns based on token estimate', () => {
    const history = Array.from({ length: 20 }, (_, i) =>
      createInteraction(i + 1, `Turn ${i + 1} content`),
    );
    const trimmed = service.trimHistory(history);
    // keepRecentTurns default 4, but trimHistory uses maxTokens (100) with 50 tokens per turn => 2 turns max
    expect(trimmed.length).toBeLessThanOrEqual(2);
  });

  it('should return all history if under token limit', () => {
    const history = [createInteraction(1, 'Short'), createInteraction(2, 'Short')];
    const trimmed = service.trimHistory(history, 200);
    expect(trimmed).toHaveLength(2);
    expect(trimmed[0].turnNumber).toBe(1);
  });

  it('should summarize older turns', () => {
    const history = [
      createInteraction(1, 'Hello'),
      createInteraction(2, 'How are you?'),
      createInteraction(3, 'I am fine'),
      createInteraction(4, 'Great'),
      createInteraction(5, 'Bye'),
    ];
    const summary = service.summarizeOlderTurns(history, 2);
    expect(summary).toContain('[RESUMEN DE CONVERSACIÓN ANTERIOR]');
    // Older turns (first 3) should be in summary
    expect(summary).toContain('Hello');
    expect(summary).toContain('How are you?');
    expect(summary).toContain('I am fine');
    // Recent turns (last 2: Great, Bye) should not be in summary
    expect(summary).not.toContain('Great');
    expect(summary).not.toContain('Bye');
  });

  it('should return empty string if no older turns', () => {
    const history = [createInteraction(1, 'First'), createInteraction(2, 'Second')];
    const summary = service.summarizeOlderTurns(history, 2);
    expect(summary).toBe('');
  });
});
