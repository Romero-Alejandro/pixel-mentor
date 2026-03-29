import type { Interaction } from '@/domain/entities/interaction.js';

export interface ContextWindowConfig {
  maxTokens: number;
  keepRecentTurns: number;
}

const DEFAULT_CONFIG: ContextWindowConfig = {
  maxTokens: 8000,
  keepRecentTurns: 6,
};

export class ContextWindowService {
  constructor(private config: ContextWindowConfig = DEFAULT_CONFIG) {}

  trimHistory(history: Interaction[], maxTokens?: number): Interaction[] {
    const limit = maxTokens || this.config.maxTokens;
    // Naive estimation: assume ~50 tokens per turn
    const estimatedTurnTokens = 50;
    // If limit is 0, no tokens allowed
    if (limit === 0) {
      return [];
    }
    // Calculate maximum turns that can fit; ensure at least 1 turn if limit > 0
    const calculatedTurns = Math.floor(limit / estimatedTurnTokens);
    const maxTurns = calculatedTurns === 0 ? 1 : calculatedTurns;
    return history.slice(-maxTurns);
  }

  summarizeOlderTurns(
    history: Interaction[],
    keepRecent: number = this.config.keepRecentTurns,
  ): string {
    // Handle keepRecent = 0 to summarize all turns
    const olderTurns = keepRecent === 0 ? history : history.slice(0, -keepRecent);
    if (olderTurns.length === 0) {
      return '';
    }

    const summaries = olderTurns.map((turn) => {
      const role = turn.turnNumber % 2 === 1 ? 'Estudiante' : 'Tutor';
      const content = turn.transcript.slice(0, 100); // truncate
      return `${role}: ${content}${turn.transcript.length > 100 ? '...' : ''}`;
    });

    return `[RESUMEN DE CONVERSACIÓN ANTERIOR]\n${summaries.join('\n')}\n[/RESUMEN]`;
  }
}
