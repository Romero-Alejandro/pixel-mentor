import type { PedagogicalState } from '@/domain/entities/pedagogical-state';

export type StateTransition =
  | 'START_LESSON'
  | 'EXPLAIN_CONCEPT'
  | 'ASK_QUESTION'
  | 'RECEIVE_ANSWER'
  | 'EVALUATE_ANSWER'
  | 'ADVANCE_QUESTION'
  | 'COMPLETE_LESSON'
  | 'RETRY_CONCEPT';

export type StateEvent =
  | { type: 'START'; lessonId: string }
  | { type: 'EXPLAIN'; conceptIndex: number }
  | { type: 'ASK'; questionIndex: number }
  | { type: 'ANSWER'; answer: string }
  | { type: 'EVALUATE'; isCorrect: boolean }
  | { type: 'ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'RETRY' };

export interface ValidTransition {
  readonly from: PedagogicalState;
  readonly to: PedagogicalState;
  readonly event: StateEvent['type'];
  readonly isValid: boolean;
}

export const TRANSITION_MAP: ReadonlyMap<
  PedagogicalState,
  ReadonlyArray<ValidTransition>
> = new Map([
  [
    'EXPLANATION',
    [
      { from: 'EXPLANATION', to: 'QUESTION', event: 'EXPLAIN', isValid: true },
      { from: 'EXPLANATION', to: 'EXPLANATION', event: 'RETRY', isValid: true },
    ],
  ],
  [
    'QUESTION',
    [
      { from: 'QUESTION', to: 'EVALUATION', event: 'ANSWER', isValid: true },
      { from: 'QUESTION', to: 'EXPLANATION', event: 'RETRY', isValid: true },
    ],
  ],
  [
    'EVALUATION',
    [
      { from: 'EVALUATION', to: 'QUESTION', event: 'ADVANCE', isValid: true },
      { from: 'EVALUATION', to: 'EXPLANATION', event: 'RETRY', isValid: true },
      { from: 'EVALUATION', to: 'QUESTION', event: 'COMPLETE', isValid: true },
    ],
  ],
]);

export function getAllowedTransitions(
  currentState: PedagogicalState,
): ReadonlyArray<ValidTransition> {
  return TRANSITION_MAP.get(currentState) ?? [];
}

export function isTransitionAllowed(
  currentState: PedagogicalState,
  event: StateEvent['type'],
): boolean {
  const transitions = TRANSITION_MAP.get(currentState);
  if (!transitions) {
    return false;
  }
  return transitions.some((t) => t.event === event && t.isValid);
}

export function getNextState(currentState: PedagogicalState, event: StateEvent): PedagogicalState {
  if (!isTransitionAllowed(currentState, event.type)) {
    return currentState;
  }

  switch (event.type) {
    case 'START':
      return 'EXPLANATION';
    case 'EXPLAIN':
      return 'QUESTION';
    case 'ANSWER':
      return 'EVALUATION';
    case 'EVALUATE':
      return event.isCorrect ? 'QUESTION' : 'EXPLANATION';
    case 'ADVANCE':
      return 'QUESTION';
    case 'COMPLETE':
      return 'EVALUATION';
    case 'RETRY':
      return 'EXPLANATION';
    default:
      return currentState;
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly currentState: PedagogicalState,
    public readonly attemptedEvent: StateEvent['type'],
  ) {
    super(`Invalid transition: cannot execute '${attemptedEvent}' from state '${currentState}'`);
    this.name = 'InvalidTransitionError';
  }
}

export function attemptTransition(
  currentState: PedagogicalState,
  event: StateEvent,
): PedagogicalState {
  if (!isTransitionAllowed(currentState, event.type)) {
    throw new InvalidTransitionError(currentState, event.type);
  }
  return getNextState(currentState, event);
}

export function getTransitionDescription(from: PedagogicalState, to: PedagogicalState): string {
  return `Transition from ${from} to ${to}`;
}
