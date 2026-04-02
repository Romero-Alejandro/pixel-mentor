export type ClassificationIntent = 'question' | 'answer' | 'statement' | 'greeting' | 'other';

export interface QuestionClassification {
  readonly intent: ClassificationIntent;
  readonly confidence: number;
  readonly reasoning?: string;
}

export interface ClassificationThresholds {
  readonly acceptThreshold: number; // >= 0.85: action based on intent
  readonly clarifyThreshold: number; // 0.6-0.85: ask for clarification
  // < clarifyThreshold: continue unless explicit confirmation
}

// PRD thresholds
export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  acceptThreshold: 0.85,
  clarifyThreshold: 0.6,
} as const;

export type ClassificationAction =
  | { type: 'ACCEPT'; intent: ClassificationIntent }
  | { type: 'CLARIFY'; intent: ClassificationIntent; confidence: number }
  | { type: 'CONTINUE' };

export function determineClassificationAction(
  classification: QuestionClassification,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): ClassificationAction {
  if (classification.confidence >= thresholds.acceptThreshold) {
    return { type: 'ACCEPT', intent: classification.intent };
  }

  if (classification.confidence >= thresholds.clarifyThreshold) {
    return {
      type: 'CLARIFY',
      intent: classification.intent,
      confidence: classification.confidence,
    };
  }

  return { type: 'CONTINUE' };
}

export function isQuestionIntent(intent: ClassificationIntent): boolean {
  return intent === 'question';
}

export function requiresEscalation(
  failedAttempts: number,
  hasSafetyFlag: boolean,
  isOutOfScope: boolean,
  maxAttempts: number = 2,
): boolean {
  return failedAttempts > maxAttempts || hasSafetyFlag || isOutOfScope;
}
