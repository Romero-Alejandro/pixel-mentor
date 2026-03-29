import type { PedagogicalState } from '../entities/pedagogical-state.js';
import type { Recipe } from '../entities/recipe.js';

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
