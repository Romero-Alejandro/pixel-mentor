import type { Recipe } from '../entities/recipe.entity.js';

import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';
import type { MicroInteraction } from '@/features/gamification/domain/entities/micro-interaction.entity.js';

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

export interface AIAnswerResponse {
  answer: string;
}

export interface GenerateResponseParams {
  recipe: Recipe;
  currentState: PedagogicalState;
  nextState?: PedagogicalState;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentQuestion?: { text: string; options?: readonly string[] };
  ragContext?: unknown;
  currentSegment?: { chunkText: string; order: number };
  totalSegments?: number;
  historySummary?: string;
  [key: string]: unknown;
}

export interface AIService {
  generateResponse(params: GenerateResponseParams): Promise<AIResponse>;
  generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string>;
  generateAnswer(params: {
    question: string;
    context: string;
    recipeTitle: string;
  }): Promise<AIAnswerResponse>;
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
