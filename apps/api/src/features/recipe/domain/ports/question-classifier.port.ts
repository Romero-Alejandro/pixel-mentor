import type { QuestionClassification } from '@/features/activity/domain/entities/question-classification.entity';

export interface ClassificationPayload {
  readonly transcript: string;
  readonly lastTurns: readonly { role: 'user' | 'assistant'; content: string }[];
  readonly lessonMetadata?: {
    readonly title: string;
    readonly concepts: readonly string[];
  };
}

export interface QuestionClassifier {
  classify(payload: ClassificationPayload): Promise<QuestionClassification>;
}

export interface ComprehensionEvaluation {
  readonly result: 'correct' | 'partial' | 'incorrect';
  readonly confidence: number;
  readonly hint?: string;
  readonly shouldEscalate: boolean;
}

// PRD thresholds for comprehension
export const COMPREHENSION_THRESHOLDS = {
  correct: 0.8,
  partial: 0.5,
} as const;

export interface ComprehensionPayload {
  readonly microQuestion: string;
  readonly expectedAnswer: string;
  readonly studentAnswer: string;
  readonly attemptNumber: number;
}

export interface ComprehensionEvaluator {
  evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation>;
}

export class ClassificationError extends Error {
  readonly code = 'CLASSIFICATION_ERROR' as const;
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'ClassificationError';
    this.originalError = originalError;
  }
}
