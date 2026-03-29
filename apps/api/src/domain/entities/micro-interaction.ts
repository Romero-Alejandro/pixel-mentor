export type MicroInteractionType = 'HOOK' | 'QUESTION' | 'REINFORCE';

export interface MicroInteraction {
  type: MicroInteractionType;
  text: string;
}

import type { PedagogicalState } from './pedagogical-state.js';

/**
 * Determina una micro-interacción de fallback basada en el estado pedagógico.
 * Se utiliza cuando el LLM no proporciona microInteraction en la respuesta.
 */
export function determineMicroInteraction(
  state: PedagogicalState,
  _segmentIndex: number,
  _segment?: unknown,
): MicroInteraction {
  switch (state) {
    case 'ACTIVE_CLASS':
      return { type: 'HOOK', text: '¿Listo para el siguiente desafío?' };
    case 'RESOLVING_DOUBT':
      return { type: 'REINFORCE', text: '¿Te quedó más claro?' };
    case 'QUESTION':
      return { type: 'QUESTION', text: '¿Cuál es tu respuesta?' };
    case 'EVALUATION':
      return { type: 'REINFORCE', text: '¿Quieres intentarlo de nuevo?' };
    case 'CLARIFYING':
      return { type: 'QUESTION', text: '¿Puedes especificar qué te confunde?' };
    case 'COMPLETED':
      return { type: 'REINFORCE', text: '¡Felicidades! ¿Quieres repasar algo?' };
    case 'EXPLANATION':
      return { type: 'HOOK', text: '¿Tiene sentido hasta ahora?' };
    default:
      return { type: 'HOOK', text: '¿Alguien tiene alguna pregunta?' };
  }
}
