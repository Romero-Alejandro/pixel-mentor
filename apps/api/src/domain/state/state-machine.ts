import type { PedagogicalState } from '../entities/pedagogical-state';

export type StateEventType =
  | 'EXPLAIN'
  | 'ANSWER'
  | 'ADVANCE'
  | 'COMPLETE'
  | 'EVALUATE'
  | 'RAISE_HAND'
  | 'RESUME_CLASS'
  | 'CONTINUE'
  | 'ASK_QUESTION'
  | 'VALIDATE'
  | 'CLARIFY';

export interface StateEvent {
  type: StateEventType;
  conceptIndex?: number;
  answer?: string;
  isCorrect?: boolean;
}

const transitions: Record<PedagogicalState, Partial<Record<StateEventType, PedagogicalState>>> = {
  ACTIVE_CLASS: {
    RAISE_HAND: 'RESOLVING_DOUBT',
    CONTINUE: 'ACTIVE_CLASS',
    ASK_QUESTION: 'QUESTION',
    CLARIFY: 'CLARIFYING',
  },
  RESOLVING_DOUBT: {
    RESUME_CLASS: 'ACTIVE_CLASS',
  },
  CLARIFYING: {
    RESUME_CLASS: 'ACTIVE_CLASS',
  },
  QUESTION: {
    ANSWER: 'EVALUATION',
  },
  EVALUATION: {
    ADVANCE: 'QUESTION',
    COMPLETE: 'COMPLETED',
    VALIDATE: 'ACTIVE_CLASS', // Si es última pregunta, se mapea a COMPLETED en lógica
  },
  COMPLETED: {},
  EXPLANATION: {
    EXPLAIN: 'QUESTION',
  },
};

export const getNextState = (
  currentState: PedagogicalState,
  event: StateEvent,
): PedagogicalState => {
  return transitions[currentState]?.[event.type] || currentState;
};

export const getAllowedTransitions = (state: PedagogicalState): StateEventType[] => {
  return Object.keys(transitions[state] || {}) as StateEventType[];
};

export const isTransitionAllowed = (
  state: PedagogicalState,
  eventType: StateEventType,
): boolean => {
  return getAllowedTransitions(state).includes(eventType);
};

export class InvalidTransitionError extends Error {
  constructor(currentState: PedagogicalState, eventType: StateEventType) {
    super(`Invalid transition from ${currentState} with event ${eventType}`);
    this.name = 'InvalidTransitionError';
  }
}

export const attemptTransition = (
  currentState: PedagogicalState,
  event: StateEvent,
): PedagogicalState => {
  if (!isTransitionAllowed(currentState, event.type)) {
    throw new InvalidTransitionError(currentState, event.type);
  }
  return getNextState(currentState, event);
};

export class PedagogicalStateMachine {
  private state: PedagogicalState;

  constructor(initialState: PedagogicalState) {
    this.state = initialState;
  }

  transition(event: StateEventType): PedagogicalState {
    this.state = attemptTransition(this.state, { type: event });
    return this.state;
  }

  getCurrentState(): PedagogicalState {
    return this.state;
  }
}
