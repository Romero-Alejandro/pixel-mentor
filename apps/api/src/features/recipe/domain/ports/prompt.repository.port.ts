import type { Recipe } from '../entities/recipe.entity.js';

import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';

export interface PromptParams {
  lesson: Recipe;
  currentState: PedagogicalState;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentQuestion?: { text: string; options?: readonly string[] };
  ragContext?: Array<{ chunk?: { chunkText: string }; text?: string }>;
  currentSegment?: { chunkText: string; order: number };
  totalSegments?: number;
  persona?: string;
  historySummary?: string;
}

export interface PromptRepository {
  getPrompt(state: PedagogicalState, params: PromptParams): string;
}
