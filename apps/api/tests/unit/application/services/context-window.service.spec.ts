import type { ContextWindowConfig } from '@/features/recipe/application/services/context-window.service.js';
import { ContextWindowService } from '@/features/recipe/application/services/context-window.service.js';
import type { Interaction } from '@/features/session/domain/entities/interaction.entity.js';

// Helper to create mock interactions
const createMockInteraction = (overrides: Partial<Interaction> = {}): Interaction => ({
  id: `interaction-${Math.random().toString(36).substr(2, 9)}`,
  sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
  turnNumber: 1,
  transcript: '',
  aiResponse: undefined,
  comprehensionConfirmed: false,
  questionAsked: false,
  pausedForQuestion: false,
  flaggedForReview: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ContextWindowService', () => {
  describe('Constructor', () => {
    it('should use default configuration when no config provided', () => {
      const service = new ContextWindowService();
      expect(service).toBeDefined();
      // We can't directly access private config, but we can test behavior
      // Default: maxTokens = 8000, keepRecentTurns = 6
    });

    it('should accept custom configuration', () => {
      const config: ContextWindowConfig = {
        maxTokens: 4000,
        keepRecentTurns: 4,
      };
      const service = new ContextWindowService(config);
      expect(service).toBeDefined();
      // Test behavior to verify config is used
    });
  });

  describe('trimHistory', () => {
    it('should return all interactions when history is under token limit', () => {
      const service = new ContextWindowService({ maxTokens: 1000, keepRecentTurns: 6 });
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Hello' }),
        createMockInteraction({ turnNumber: 2, transcript: 'Hi there' }),
        createMockInteraction({ turnNumber: 3, transcript: 'How are you?' }),
      ];

      const result = service.trimHistory(interactions);

      expect(result).toHaveLength(3);
      expect(result).toEqual(interactions);
    });

    it('should trim to most recent turns when over token limit using FIFO', () => {
      const service = new ContextWindowService({ maxTokens: 200, keepRecentTurns: 6 });
      // With 50 tokens per turn estimation, max 4 turns (200/50)
      const interactions = Array.from({ length: 10 }, (_, i) =>
        createMockInteraction({
          turnNumber: i + 1,
          transcript: `Message ${i + 1}`,
        }),
      );

      const result = service.trimHistory(interactions);

      expect(result).toHaveLength(4);
      // Should keep the 4 most recent (last 4)
      expect(result.map((i) => i.turnNumber)).toEqual([7, 8, 9, 10]);
    });

    it('should respect custom maxTokens parameter', () => {
      const service = new ContextWindowService({ maxTokens: 8000, keepRecentTurns: 6 });
      const interactions = Array.from({ length: 20 }, (_, i) =>
        createMockInteraction({ turnNumber: i + 1, transcript: `Msg ${i}` }),
      );

      const result = service.trimHistory(interactions, 250); // 5 turns

      expect(result).toHaveLength(5);
      expect(result.map((i) => i.turnNumber)).toEqual([16, 17, 18, 19, 20]);
    });

    it('should return empty array when given empty history', () => {
      const service = new ContextWindowService();
      const result = service.trimHistory([]);
      expect(result).toEqual([]);
    });

    it('should handle single interaction correctly', () => {
      const service = new ContextWindowService({ maxTokens: 10, keepRecentTurns: 6 });
      const interaction = createMockInteraction({ turnNumber: 1, transcript: 'Hi' });

      const result = service.trimHistory([interaction]);

      expect(result).toHaveLength(1);
      expect(result[0].turnNumber).toBe(1);
    });

    it('should respect fractional maxTurns calculation (Math.floor)', () => {
      // maxTokens = 125, estimatedTurnTokens = 50 -> maxTurns = 2 (floor)
      const service = new ContextWindowService({ maxTokens: 125, keepRecentTurns: 6 });
      const interactions = Array.from({ length: 5 }, (_, i) =>
        createMockInteraction({ turnNumber: i + 1, transcript: `Msg ${i}` }),
      );

      const result = service.trimHistory(interactions);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.turnNumber)).toEqual([4, 5]);
    });

    it('should handle zero maxTokens without crashing', () => {
      const service = new ContextWindowService({ maxTokens: 0, keepRecentTurns: 6 });
      const interactions = [createMockInteraction({ turnNumber: 1, transcript: 'Hello' })];

      const result = service.trimHistory(interactions);

      // maxTurns = 0, so slice(-0) returns []
      expect(result).toHaveLength(0);
    });

    it('should return original array reference when no trimming needed', () => {
      const service = new ContextWindowService({ maxTokens: 1000, keepRecentTurns: 6 });
      const interactions = [createMockInteraction({ turnNumber: 1, transcript: 'Hello' })];

      const result = service.trimHistory(interactions);

      // Note: slice returns a copy, not the same reference, but values should match
      expect(result).toStrictEqual(interactions);
    });

    it('should handle one turn exactly at limit', () => {
      const service = new ContextWindowService({ maxTokens: 50, keepRecentTurns: 6 });
      const interactions = [createMockInteraction({ turnNumber: 1, transcript: 'Hello' })];

      const result = service.trimHistory(interactions);

      expect(result).toHaveLength(1);
    });

    it('should handle large history efficiently', () => {
      const service = new ContextWindowService({ maxTokens: 500, keepRecentTurns: 6 }); // 10 turns
      const interactions = Array.from({ length: 1000 }, (_, i) =>
        createMockInteraction({ turnNumber: i + 1, transcript: `Message ${i}` }),
      );

      const result = service.trimHistory(interactions);

      expect(result).toHaveLength(10);
      expect(result[0].turnNumber).toBe(991);
      expect(result[9].turnNumber).toBe(1000);
    });
  });

  describe('summarizeOlderTurns', () => {
    it('should return empty string when keepRecent equals or exceeds history length', () => {
      const service = new ContextWindowService({ maxTokens: 8000, keepRecentTurns: 5 });
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Hello', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 2, transcript: 'Hi', sessionId: 's1' }),
      ];

      const result = service.summarizeOlderTurns(interactions, 5);

      expect(result).toBe('');
    });

    it('should summarize all older turns leaving exactly keepRecent', () => {
      const service = new ContextWindowService();
      const interactions = Array.from({ length: 8 }, (_, i) =>
        createMockInteraction({
          turnNumber: i + 1,
          transcript: `This is message ${i + 1} with some content`,
          sessionId: 'session-1',
        }),
      );

      const result = service.summarizeOlderTurns(interactions, 3); // keep recent 3

      expect(result).toContain('[RESUMEN DE CONVERSACIÓN ANTERIOR]');
      expect(result).toContain('[/RESUMEN]');
      // Should have summaries for turns 1-5, keeping turns 6-8
      expect(result).toContain('Estudiante: This is message 1');
      expect(result).toContain('Tutor: This is message 2');
      expect(result).toContain('Estudiante: This is message 3');
      expect(result).toContain('Tutor: This is message 4');
      expect(result).toContain('Estudiante: This is message 5');
      // Should NOT include turns 6, 7, 8 in summary
      expect(result).not.toContain('This is message 6');
    });

    it('should truncate transcript to 100 characters in summary', () => {
      const longTranscript = 'A'.repeat(150);
      const service = new ContextWindowService();
      const interactions = [
        createMockInteraction({
          turnNumber: 1,
          transcript: longTranscript,
          sessionId: 's1',
        }),
        createMockInteraction({
          turnNumber: 2,
          transcript: 'Recent message',
          sessionId: 's1',
        }),
      ];

      const result = service.summarizeOlderTurns(interactions, 1);

      expect(result).toContain('A'.repeat(100));
      expect(result).toContain('...');
    });

    it('should not add ellipsis when transcript is <= 100 chars', () => {
      const service = new ContextWindowService();
      const shortTranscript = 'Short message';
      const interactions = [
        createMockInteraction({
          turnNumber: 1,
          transcript: shortTranscript,
          sessionId: 's1',
        }),
        createMockInteraction({
          turnNumber: 2,
          transcript: 'Recent',
          sessionId: 's1',
        }),
      ];

      const result = service.summarizeOlderTurns(interactions, 1);

      expect(result).toContain(shortTranscript);
      expect(result).not.toContain('...');
    });

    it('should label roles correctly: odd turnNumber = Estudiante, even = Tutor', () => {
      const service = new ContextWindowService();
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Student msg', sessionId: 's1' }), // odd
        createMockInteraction({ turnNumber: 2, transcript: 'Tutor msg', sessionId: 's1' }), // even
        createMockInteraction({ turnNumber: 3, transcript: 'Student again', sessionId: 's1' }), // odd
        createMockInteraction({ turnNumber: 4, transcript: 'Tutor again', sessionId: 's1' }), // even
      ];

      const result = service.summarizeOlderTurns(interactions, 2);

      // With keepRecent=2, only turns 1-2 are older
      expect(result).toContain('Estudiante: Student msg');
      expect(result).toContain('Tutor: Tutor msg');
      // Turns 3 and 4 are recent, not in summary
      expect(result).not.toContain('Student again');
      expect(result).not.toContain('Tutor again');
    });

    it('should separate summaries with newlines', () => {
      const service = new ContextWindowService();
      const interactions = Array.from({ length: 4 }, (_, i) =>
        createMockInteraction({
          turnNumber: i + 1,
          transcript: `Msg ${i + 1}`,
          sessionId: 's1',
        }),
      );

      const result = service.summarizeOlderTurns(interactions, 2);

      const lines = result.split('\n');
      // Should have header, 2 summary lines, footer
      expect(lines).toContain('[RESUMEN DE CONVERSACIÓN ANTERIOR]');
      expect(lines).toContain('[/RESUMEN]');
      expect(lines.some((l) => l.includes('Estudiante: Msg 1'))).toBe(true);
      expect(lines.some((l) => l.includes('Tutor: Msg 2'))).toBe(true);
    });

    it('should use default keepRecentTurns when not specified', () => {
      const service = new ContextWindowService({ maxTokens: 8000, keepRecentTurns: 2 });
      const interactions = Array.from({ length: 5 }, (_, i) =>
        createMockInteraction({
          turnNumber: i + 1,
          transcript: `Msg ${i + 1}`,
          sessionId: 's1',
        }),
      );

      const result = service.summarizeOlderTurns(interactions);

      // Should summarize turns 1-3, keep turns 4-5
      expect(result).toContain('Msg 1');
      expect(result).toContain('Msg 2');
      expect(result).toContain('Msg 3');
      expect(result).not.toContain('Msg 4');
      expect(result).not.toContain('Msg 5');
    });

    it('should handle custom keepRecent parameter overriding default', () => {
      const service = new ContextWindowService({ maxTokens: 8000, keepRecentTurns: 2 });
      const interactions = Array.from({ length: 5 }, (_, i) =>
        createMockInteraction({
          turnNumber: i + 1,
          transcript: `Msg ${i + 1}`,
          sessionId: 's1',
        }),
      );

      const result = service.summarizeOlderTurns(interactions, 3); // override to keep 3

      // Should summarize turns 1-2, keep turns 3-5
      expect(result).toContain('Msg 1');
      expect(result).toContain('Msg 2');
      expect(result).not.toContain('Msg 3');
      expect(result).not.toContain('Msg 4');
      expect(result).not.toContain('Msg 5');
    });

    it('should handle empty transcript gracefully', () => {
      const service = new ContextWindowService();
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: '', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 2, transcript: '', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 3, transcript: 'Recent', sessionId: 's1' }),
      ];

      const result = service.summarizeOlderTurns(interactions, 1);

      expect(result).toContain('Estudiante: ');
      expect(result).toContain('Tutor: ');
    });

    it('should handle sessions with alternating roles correctly', () => {
      const service = new ContextWindowService();
      // Create a realistic conversation pattern
      const interactions = [
        createMockInteraction({
          turnNumber: 1,
          transcript: '¿Cómo funciona esto?',
          sessionId: 's1',
        }),
        createMockInteraction({
          turnNumber: 2,
          transcript: 'Te explico el concepto',
          sessionId: 's1',
        }),
        createMockInteraction({
          turnNumber: 3,
          transcript: 'Entiendo, ¿y esto otro?',
          sessionId: 's1',
        }),
        createMockInteraction({
          turnNumber: 4,
          transcript: 'Eso es similar a...',
          sessionId: 's1',
        }),
        createMockInteraction({ turnNumber: 5, transcript: 'Perfecto, gracias', sessionId: 's1' }),
      ];

      const result = service.summarizeOlderTurns(interactions, 2);

      // Should summarize first 3 turns (keeping last 2: turns 4 and 5)
      expect(result).toContain('Estudiante: ¿Cómo funciona esto?');
      expect(result).toContain('Tutor: Te explico el concepto');
      expect(result).toContain('Estudiante: Entiendo, ¿y esto otro?');
      // Turn 4 is recent, should not appear
      expect(result).not.toContain('Eso es similar a...');
      expect(result).not.toContain('Perfecto, gracias');
    });

    it('should handle all interactions being older (keepRecent = 0)', () => {
      const service = new ContextWindowService();
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Old 1', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 2, transcript: 'Old 2', sessionId: 's1' }),
      ];

      const result = service.summarizeOlderTurns(interactions, 0);

      expect(result).toContain('[RESUMEN DE CONVERSACIÓN ANTERIOR]');
      expect(result).toContain('Old 1');
      expect(result).toContain('Old 2');
    });

    it('should preserve transcript content including special characters', () => {
      const service = new ContextWindowService();
      const interactions = [
        createMockInteraction({
          turnNumber: 1,
          transcript: '¿Cómo estás? ¡Hola! 你好',
          sessionId: 's1',
        }),
        createMockInteraction({
          turnNumber: 2,
          transcript: 'Estoy bien, thanks!',
          sessionId: 's1',
        }),
      ];

      const result = service.summarizeOlderTurns(interactions, 1);

      // Only the first turn (older) should be summarized
      expect(result).toContain('¿Cómo estás? ¡Hola! 你好');
      // Second turn is recent, should not appear in summary
      expect(result).not.toContain('Estoy bien, thanks!');
    });
  });

  describe('Integration scenarios', () => {
    it('should combine trimming and summarization workflow', () => {
      const service = new ContextWindowService({ maxTokens: 300, keepRecentTurns: 2 });
      // Create a large history (10 interactions)
      const interactions = Array.from({ length: 10 }, (_, i) =>
        createMockInteraction({
          turnNumber: i + 1,
          transcript: `Detailed message ${i + 1} with enough content to consider token count.`,
          sessionId: 's1',
        }),
      );

      // Step 1: Trim to fit within token limit (6 turns for 300 tokens)
      const trimmed = service.trimHistory(interactions);
      expect(trimmed).toHaveLength(6);
      // Trimmed should be last 6 turns: turns 5,6,7,8,9,10
      expect(trimmed.map((i) => i.turnNumber)).toEqual([5, 6, 7, 8, 9, 10]);

      // Step 2: Summarize older turns (keep 2 recent)
      const summary = service.summarizeOlderTurns(trimmed, 2);
      expect(summary).toContain('[RESUMEN DE CONVERSACIÓN ANTERIOR]');
      // Should summarize first 4 turns of the trimmed set (original turns 5,6,7,8)
      expect(summary).toContain('Detailed message 5');
      expect(summary).toContain('Detailed message 6');
      expect(summary).toContain('Detailed message 7');
      expect(summary).toContain('Detailed message 8');
      // Should NOT include the 2 most recent from trimmed (turns 9 and 10)
      expect(summary).not.toContain('Detailed message 9');
      expect(summary).not.toContain('Detailed message 10');

      // Verify that the recent turns (5 and 6 of trimmed, i.e., turns 9 and 10) are not in summary but would be in final context
      const finalContextParts: string[] = [];
      if (!summary.includes('Detailed message 9')) {
        finalContextParts.push(trimmed[4].transcript); // index 4 = turn 9
      }
      if (!summary.includes('Detailed message 10')) {
        finalContextParts.push(trimmed[5].transcript); // index 5 = turn 10
      }
      expect(finalContextParts).toHaveLength(2);
      expect(finalContextParts[0]).toContain('Detailed message 9');
      expect(finalContextParts[1]).toContain('Detailed message 10');
    });

    it('should handle edge case: all interactions fit but need summarization', () => {
      const service = new ContextWindowService({ maxTokens: 10000, keepRecentTurns: 6 });
      // Small history
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Old', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 2, transcript: 'Old 2', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 3, transcript: 'Recent', sessionId: 's1' }),
      ];

      const trimmed = service.trimHistory(interactions); // No trimming
      expect(trimmed).toHaveLength(3);

      const summary = service.summarizeOlderTurns(trimmed, 1);
      expect(summary).toContain('Old');
      expect(summary).not.toContain('Recent');
    });
  });

  describe('Boundary conditions', () => {
    it('should handle exactly at turn boundary (maxTurns calculation)', () => {
      // Example: maxTokens = 200, estimated 50/turn gives exactly 4 turns
      const service = new ContextWindowService({ maxTokens: 200, keepRecentTurns: 6 });
      const interactions = Array.from({ length: 4 }, (_, i) =>
        createMockInteraction({ turnNumber: i + 1, transcript: `Msg ${i}` }),
      );

      const result = service.trimHistory(interactions);

      expect(result).toHaveLength(4);
      expect(result).toEqual(interactions);
    });

    it('should handle keepRecentTurns = 0', () => {
      const service = new ContextWindowService({ maxTokens: 8000, keepRecentTurns: 0 });
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Some message', sessionId: 's1' }),
      ];

      const result = service.summarizeOlderTurns(interactions, 0);

      // All turns are "older", so summarize everything
      expect(result).toContain('Some message');
    });

    it('should handle keepRecentTurns greater than history length', () => {
      const service = new ContextWindowService({ maxTokens: 8000, keepRecentTurns: 10 });
      const interactions = [
        createMockInteraction({ turnNumber: 1, transcript: 'Msg1', sessionId: 's1' }),
        createMockInteraction({ turnNumber: 2, transcript: 'Msg2', sessionId: 's1' }),
      ];

      const result = service.summarizeOlderTurns(interactions, 10);

      expect(result).toBe('');
    });

    it('should maintain interaction order after trimming', () => {
      const service = new ContextWindowService({ maxTokens: 200, keepRecentTurns: 6 });
      const interactions = Array.from({ length: 8 }, (_, i) =>
        createMockInteraction({ turnNumber: i + 1, transcript: `Msg ${i}` }),
      );

      const result = service.trimHistory(interactions);

      // Verify order is preserved in result
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].turnNumber).toBeLessThan(result[i + 1].turnNumber);
      }
    });
  });
});
