export type PedagogicalState =
  // Estados de control de clase
  | 'AWAITING_START' // NUEVO: Esperando confirmación del estudiante para iniciar
  | 'ACTIVE_CLASS' // Clase activamente en progreso
  
  // Estados de dudas y preguntas
  | 'RESOLVING_DOUBT' // Resolviendo duda del estudiante
  | 'CLARIFYING' // Solicitando clarificación
  
  // Estados de explicación y actividades
  | 'EXPLANATION' // El tutor explica un concepto
  | 'ACTIVITY_WAIT' // NUEVO: Esperando respuesta a actividad (con timer)
  | 'ACTIVITY_INACTIVITY_WARNING' // NUEVO: Mostrando mensaje de ánimo
  | 'ACTIVITY_SKIP_OFFER' // NUEVO: Ofreciendo saltar actividad
  | 'QUESTION' // Pregunta formal al estudiante
  | 'EVALUATION' // Evaluando respuesta
  
  // Estados finales
  | 'COMPLETED'; // Lección completada

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

export function isPedagogicalState(value: unknown): value is PedagogicalState {
  return PEDAGOGICAL_STATES.includes(value as PedagogicalState);
}

export function getStateDescription(state: PedagogicalState): string {
  switch (state) {
    case 'AWAITING_START':
      return 'Esperando que el estudiante confirme el inicio de la clase';
    case 'ACTIVE_CLASS':
      return 'Clase activa: entrega de contenido pedagógico';
    case 'RESOLVING_DOUBT':
      return 'Resolviendo duda del estudiante';
    case 'CLARIFYING':
      return 'Solicitando clarificación del estudiante';
    case 'EXPLANATION':
      return 'El tutor explica un concepto al estudiante';
    case 'ACTIVITY_WAIT':
      return 'Esperando respuesta del estudiante a la actividad';
    case 'ACTIVITY_INACTIVITY_WARNING':
      return 'Mostrando mensaje de ánimo al estudiante';
    case 'ACTIVITY_SKIP_OFFER':
      return 'Ofreciendo saltar la actividad';
    case 'QUESTION':
      return 'Pregunta formal planteada al estudiante';
    case 'EVALUATION':
      return 'Evaluando respuesta del estudiante';
    case 'COMPLETED':
      return 'Lección completada';
    default:
      return 'Estado desconocido';
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

export function canRaiseHand(state: PedagogicalState): boolean {
  // Levantar mano solo está permitido durante explicaciones
  return state === 'EXPLANATION' || state === 'ACTIVE_CLASS';
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

export function isActivityState(state: PedagogicalState): boolean {
  return state === 'QUESTION' || state === 'EVALUATION' || state === 'ACTIVITY_WAIT';
}
