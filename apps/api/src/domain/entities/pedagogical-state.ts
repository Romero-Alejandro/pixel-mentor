export type PedagogicalState =
  | 'ACTIVE_CLASS'
  | 'RESOLVING_DOUBT'
  | 'CLARIFYING'
  | 'QUESTION'
  | 'EVALUATION'
  | 'COMPLETED'
  // Legacy states for backward compatibility
  | 'EXPLANATION';

export const PEDAGOGICAL_STATES: readonly PedagogicalState[] = [
  'ACTIVE_CLASS',
  'RESOLVING_DOUBT',
  'CLARIFYING',
  'QUESTION',
  'EVALUATION',
  'COMPLETED',
  'EXPLANATION',
] as const;

export function isPedagogicalState(value: unknown): value is PedagogicalState {
  return PEDAGOGICAL_STATES.includes(value as PedagogicalState);
}

export function getStateDescription(state: PedagogicalState): string {
  switch (state) {
    case 'ACTIVE_CLASS':
      return 'Mission active: delivering gamified content';
    case 'RESOLVING_DOUBT':
      return 'Solving student doubt';
    case 'CLARIFYING':
      return 'Requesting clarification from student';
    case 'QUESTION':
      return 'Formal question posed to student';
    case 'EVALUATION':
      return 'Evaluating student answer';
    case 'COMPLETED':
      return 'Lesson completed';
    case 'EXPLANATION':
      return 'The tutor explains a concept to the student';
    default:
      return 'Unknown state';
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
