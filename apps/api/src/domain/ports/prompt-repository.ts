import type { PedagogicalState } from '../entities/pedagogical-state.js';

export interface PromptParams {
  lesson: any;
  currentState: PedagogicalState;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentQuestion?: { text: string; options?: any };
  ragContext?: any;
  currentSegment?: any;
  totalSegments?: number;
  persona?: string;
  historySummary?: string;
}

export interface PromptRepository {
  getPrompt(state: PedagogicalState, params: PromptParams): string;
}
