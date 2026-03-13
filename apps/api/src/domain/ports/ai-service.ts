import type { PedagogicalState } from '../entities/pedagogical-state.js';
import type { MicroInteraction } from '../entities/micro-interaction.js';
import type { Recipe } from '../entities/recipe.js';

export interface AIResponse {
  explanation: string;
  supportQuotes: string[];
  verificationQuestion?: string;
  microInteraction?: MicroInteraction;
  pedagogicalState: PedagogicalState;
  feedback?: string;
  isCorrect?: boolean;
  extraExplanation?: string;
}

export interface AIService {
  generateResponse(params: {
    recipe: Recipe;
    currentState: PedagogicalState;
    nextState?: PedagogicalState;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    currentQuestion?: { text: string; options?: readonly string[] };
    ragContext?: any;
    currentSegment?: { chunkText: string; order: number };
    totalSegments?: number;
    historySummary?: string;
  }): Promise<AIResponse>;
  generateExplanation(params: {
    recipe: Recipe;
    conceptIndex: number;
    segment: { chunkText: string; order: number };
  }): Promise<{ voiceText: string }>;
  evaluateResponse(params: {
    studentAnswer: string;
    expectedAnswer: string;
    microQuestion: string;
  }): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }>;
}
