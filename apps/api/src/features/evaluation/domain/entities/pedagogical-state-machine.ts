export type PedagogicalState =
  | 'AWAITING_START'
  | 'ACTIVE_CLASS'
  | 'RESOLVING_DOUBT'
  | 'CLARIFYING'
  | 'EXPLANATION'
  | 'ACTIVITY_WAIT'
  | 'ACTIVITY_INACTIVITY_WARNING'
  | 'ACTIVITY_SKIP_OFFER'
  | 'QUESTION'
  | 'EVALUATION'
  | 'COMPLETED';

export const PEDAGOGICAL_STATES: readonly PedagogicalState[] = [
  'AWAITING_START',
  'ACTIVE_CLASS',
  'RESOLVING_DOUBT',
  'CLARIFYING',
  'EXPLANATION',
  'ACTIVITY_WAIT',
  'ACTIVITY_INACTIVITY_WARNING',
  'ACTIVITY_SKIP_OFFER',
  'QUESTION',
  'EVALUATION',
  'COMPLETED',
] as const;

export type StateEventType =
  // Eventos de control de clase
  | 'START_CLASS' // Iniciar después de presentación
  | 'RESTART_CLASS' // Reiniciar clase desde el principio

  // Eventos de explicación
  | 'EXPLAIN'
  | 'CONTINUE'

  // Eventos de evaluación de respuestas
  | 'ANSWER' // Respuesta del estudiante (sin evaluar)
  | 'EVALUATE_CORRECT' // Respuesta evaluada como correcta
  | 'EVALUATE_INCORRECT' // Respuesta evaluada como incorrecta
  | 'EVALUATE_PARTIAL' // Respuesta evaluada como parcial
  | 'ADVANCE' // Avanzar al siguiente paso
  | 'COMPLETE' // Completar la lección

  // Eventos de timeouts
  | 'ACTIVITY_TIMEOUT' // Timeout de actividad
  | 'SHOW_ENCOURAGEMENT' // Mostrar mensaje de ánimo
  | 'OFFER_SKIP' // Ofrecer saltar actividad
  | 'SKIP_ACTIVITY' // Procesar decisión de salto
  | 'REPEAT_CONCEPT' // Repetir explicación del tema

  // Eventos de preguntas y dudas
  | 'RAISE_HAND' // El estudiante tiene una pregunta
  | 'RESUME_CLASS' // Regresar a la clase después de una duda
  | 'ASK_QUESTION' // Hacer una pregunta formal
  | 'CLARIFY' // Solicitar clarificación
  | 'QUESTION_COOLDOWN' // Cooldown después de pregunta
  | 'LIMIT_REACHED'; // Límite alcanzado

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
    START_CLASS: 'EXPLANATION',
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

  // Explicación del tutor
  EXPLANATION: {
    RAISE_HAND: 'RESOLVING_DOUBT',
    CLARIFY: 'CLARIFYING',
    CONTINUE: 'EXPLANATION', // Avanzar al siguiente contenido
    ACTIVITY_TIMEOUT: 'ACTIVITY_INACTIVITY_WARNING',
  },

  // Resolviendo duda del estudiante
  RESOLVING_DOUBT: {
    RESUME_CLASS: 'EXPLANATION',
    QUESTION_COOLDOWN: 'EXPLANATION',
  },

  // Solicitando clarificación
  CLARIFYING: {
    RESUME_CLASS: 'EXPLANATION',
  },

  // Esperando respuesta a actividad (CORREGIDO: evaluar antes de transitar)
  ACTIVITY_WAIT: {
    EVALUATE_CORRECT: 'EVALUATION', // Respuesta correcta
    EVALUATE_INCORRECT: 'ACTIVITY_WAIT', // Incorrecta pero puede intentar de nuevo
    SHOW_ENCOURAGEMENT: 'ACTIVITY_INACTIVITY_WARNING',
    ACTIVITY_TIMEOUT: 'ACTIVITY_SKIP_OFFER', // Timeout o max intentos alcanzados
  },

  // Mostrando mensaje de ánimo por inactividad
  ACTIVITY_INACTIVITY_WARNING: {
    EVALUATE_CORRECT: 'EVALUATION',
    EVALUATE_INCORRECT: 'ACTIVITY_WAIT',
    ACTIVITY_TIMEOUT: 'ACTIVITY_SKIP_OFFER',
  },

  // Ofreciendo saltar actividad
  ACTIVITY_SKIP_OFFER: {
    REPEAT_CONCEPT: 'EXPLANATION', // Volver a explicar
    SKIP_ACTIVITY: 'EXPLANATION', // Saltar y continuar
    CONTINUE: 'EXPLANATION', // Continuar sin saltar
  },

  // Pregunta formal
  QUESTION: {
    EVALUATE_CORRECT: 'EVALUATION',
    EVALUATE_INCORRECT: 'EVALUATION', // Las preguntas formales siempre van a evaluación
    EVALUATE_PARTIAL: 'EVALUATION',
    RAISE_HAND: 'RESOLVING_DOUBT',
  },


  // Evaluando respuesta
  EVALUATION: {
    ADVANCE: 'EXPLANATION', // Avanzar al siguiente paso
    COMPLETE: 'COMPLETED',
    OFFER_SKIP: 'ACTIVITY_SKIP_OFFER',
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
