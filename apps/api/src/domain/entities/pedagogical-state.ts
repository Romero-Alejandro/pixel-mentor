export type PedagogicalState = 'EXPLANATION' | 'QUESTION' | 'EVALUATION';

export const PEDAGOGICAL_STATES: readonly PedagogicalState[] = [
  'EXPLANATION',
  'QUESTION',
  'EVALUATION',
] as const;

export function isPedagogicalState(value: unknown): value is PedagogicalState {
  return PEDAGOGICAL_STATES.includes(value as PedagogicalState);
}

export function getStateDescription(state: PedagogicalState): string {
  switch (state) {
    case 'EXPLANATION':
      return 'The tutor explains a concept to the student';
    case 'QUESTION':
      return 'The tutor asks a question to the student';
    case 'EVALUATION':
      return 'The tutor evaluates the student response';
  }
}

export function getNextQuestionIndex(
  currentState: PedagogicalState,
  currentQuestionIndex: number,
): number {
  switch (currentState) {
    case 'EXPLANATION':
      return 0;
    case 'QUESTION':
      return currentQuestionIndex + 1;
    case 'EVALUATION':
      return currentQuestionIndex;
    default:
      return currentQuestionIndex;
  }
}

export function canAdvanceToNextQuestion(
  currentQuestionIndex: number,
  totalQuestions: number,
): boolean {
  return currentQuestionIndex < totalQuestions - 1;
}

export function isLessonCompleted(currentQuestionIndex: number, totalQuestions: number): boolean {
  return currentQuestionIndex >= totalQuestions;
}
