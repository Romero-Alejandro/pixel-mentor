import type { PedagogicalState } from '../entities/pedagogical-state';

export type StateEventType =
  // Eventos de control de clase
  | 'START_CLASS' // NUEVO: Iniciar después de presentación
  | 'RESTART_CLASS' // NUEVO: Reiniciar clase desde el principio

  // Eventos de explicación
  | 'EXPLAIN'

  // Eventos de actividad
  | 'ANSWER'
  | 'ADVANCE'
  | 'EVALUATE'
  | 'COMPLETE' // Mantener para compatibilidad
  | 'ACTIVITY_TIMEOUT' // NUEVO: Timeout de actividad
  | 'SHOW_ENCOURAGEMENT' // NUEVO: Mostrar mensaje de ánimo
  | 'OFFER_SKIP' // NUEVO: Ofrecer saltar actividad
  | 'SKIP_ACTIVITY' // NUEVO: Procesar decisión de salto
  | 'REPEAT_CONCEPT' // NUEVO: Repetir explicación del tema

  // Eventos de preguntas y dudas
  | 'RAISE_HAND'
  | 'RESUME_CLASS'
  | 'CONTINUE'
  | 'ASK_QUESTION'
  | 'VALIDATE'
  | 'CLARIFY'
  | 'QUESTION_COOLDOWN' // NUEVO: Iniciar cooldown después de pregunta
  | 'LIMIT_REACHED'; // NUEVO: Indica límite alcanzado

export interface StateEvent {
  type: StateEventType;
  conceptIndex?: number;
  answer?: string;
  isCorrect?: boolean;
  // Nuevos campos para eventos extendidos
  skipAction?: 'repeat' | 'continue'; // Para SKIP_ACTIVITY
  reason?: 'timeout' | 'failed_attempts'; // Para OFFER_SKIP
  limitType?: 'questions'; // Para LIMIT_REACHED
}

const transitions: Record<PedagogicalState, Partial<Record<StateEventType, PedagogicalState>>> = {
  // Estado inicial: esperando que el estudiante confirme
  AWAITING_START: {
    START_CLASS: 'ACTIVE_CLASS',
    RESTART_CLASS: 'AWAITING_START',
  },

  // Clase activa en progreso
  ACTIVE_CLASS: {
    RAISE_HAND: 'RESOLVING_DOUBT',
    CONTINUE: 'ACTIVE_CLASS',
    ASK_QUESTION: 'QUESTION',
    CLARIFY: 'CLARIFYING',
    EXPLAIN: 'EXPLANATION',
  },

  // Resolviendo duda del estudiante
  RESOLVING_DOUBT: {
    RESUME_CLASS: 'ACTIVE_CLASS',
    QUESTION_COOLDOWN: 'ACTIVE_CLASS',
  },

  // Solicitando clarificación
  CLARIFYING: {
    RESUME_CLASS: 'ACTIVE_CLASS',
  },

  // Explicación del tutor
  EXPLANATION: {
    RAISE_HAND: 'RESOLVING_DOUBT',
    CLARIFY: 'CLARIFYING',
    EXPLAIN: 'QUESTION', // Transición a actividad
    ACTIVITY_TIMEOUT: 'ACTIVITY_INACTIVITY_WARNING',
  },

  // Esperando respuesta a actividad
  ACTIVITY_WAIT: {
    ANSWER: 'EVALUATION',
    SHOW_ENCOURAGEMENT: 'ACTIVITY_INACTIVITY_WARNING',
    ACTIVITY_TIMEOUT: 'ACTIVITY_SKIP_OFFER',
  },

  // Mostrando mensaje de ánimo
  ACTIVITY_INACTIVITY_WARNING: {
    ANSWER: 'EVALUATION',
    ACTIVITY_TIMEOUT: 'ACTIVITY_SKIP_OFFER',
  },

  // Ofreciendo saltar actividad
  ACTIVITY_SKIP_OFFER: {
    REPEAT_CONCEPT: 'EXPLANATION',
    SKIP_ACTIVITY: 'QUESTION', // Continuar a sig actividad
    CONTINUE: 'QUESTION',
  },

  // Pregunta formal
  QUESTION: {
    ANSWER: 'EVALUATION',
    RAISE_HAND: 'RESOLVING_DOUBT', // Permitir duda durante pregunta
  },

  // Evaluando respuesta
  EVALUATION: {
    ADVANCE: 'QUESTION',
    COMPLETE: 'COMPLETED',
    VALIDATE: 'ACTIVE_CLASS',
    OFFER_SKIP: 'ACTIVITY_SKIP_OFFER', // Ofrecer salto si hay fallos
  },

  // Lección completada
  COMPLETED: {
    RESTART_CLASS: 'AWAITING_START',
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
