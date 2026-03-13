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
    const maxTurns = Math.floor(limit / estimatedTurnTokens);
    return history.slice(-maxTurns);
  }

  summarizeOlderTurns(
    history: Interaction[],
    keepRecent: number = this.config.keepRecentTurns,
  ): string {
    const olderTurns = history.slice(0, -keepRecent);
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
