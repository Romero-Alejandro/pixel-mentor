import type { Lesson } from '@/domain/entities/lesson';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state';
import type { QuestionClassification } from '@/domain/entities/question-classification';
import type {
  ClassificationPayload,
  ComprehensionEvaluation,
  ComprehensionPayload,
} from '@/domain/ports/question-classifier';

export interface PromptParameters {
  readonly lesson: Lesson;
  readonly currentState: PedagogicalState;
  readonly conversationHistory: readonly {
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }[];
  readonly currentQuestion?: {
    readonly text: string;
    readonly options?: readonly string[];
  };
}

export interface GeneratedResponse {
  readonly voiceText: string;
  readonly pedagogicalState: PedagogicalState;
  readonly feedback?: string;
  readonly isCorrect?: boolean;
  readonly extraExplanation?: string;
  readonly chainOfThought?: string;
}

export interface AIService {
  generateResponse(parameters: PromptParameters): Promise<GeneratedResponse>;
  generateExplanation(parameters: {
    lesson: Lesson;
    conceptIndex: number;
  }): Promise<GeneratedResponse>;
  evaluateResponse(parameters: {
    question: { text: string; expectedAnswer: string };
    studentAnswer: string;
  }): Promise<GeneratedResponse>;
  // Question classification (PRD: detect if user input is a question)
  classifyQuestion(payload: ClassificationPayload): Promise<QuestionClassification>;
  // Comprehension evaluation (PRD: evaluate student answer after AI response)
  evaluateComprehension(payload: ComprehensionPayload): Promise<ComprehensionEvaluation>;
}

export class AIGenerationError extends Error {
  readonly code = 'AI_GENERATION_ERROR' as const;
  readonly originalMessage?: string;

  constructor(message?: string) {
    super(message ?? 'Error generating AI response');
    this.name = 'AIGenerationError';
    this.originalMessage = message;
  }
}

export class AITimeoutError extends Error {
  readonly code = 'AI_TIMEOUT' as const;
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`AI took longer than ${timeoutMs}ms to respond`);
    this.name = 'AITimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;

export async function generateWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AITimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
