/**
 * Utility functions for managing dialogue phrases in the tutoring system
 * Provides personalized, context-aware dialogue for the AI tutor
 */

import { type LessonConfig } from '@/stores/lessonStore';
import { type PedagogicalState } from '@/services/api';

/**
 * Gets a random element from an array
 */
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Gets a greeting phrase based on the current state and configuration
 */
export function getGreetingPhrase(
  config: LessonConfig | null,
  studentName: string | null,
  state: PedagogicalState,
): string {
  // If no config or student name, use fallback
  if (!config || !studentName) {
    return getFallbackGreeting(state);
  }

  // Use personalized greeting from config if available
  switch (state) {
    case 'AWAITING_START':
      return config.greetings.intro || `¡Hola, ${studentName}! Bienvenido a la clase de hoy.`;
    case 'ACTIVE_CLASS':
      return config.greetings.readyPrompt || `¡Hola, ${studentName}! ¿Estás listo para aprender?`;
    case 'EXPLANATION':
      return (
        config.greetings.nextConceptTransition ||
        `¡Vamos, ${studentName}! Veamos este concepto juntos.`
      );
    case 'COMPLETED':
      return (
        config.greetings.completionMessage ||
        `¡Excelente trabajo, ${studentName}! Has completado la lección.`
      );
    default:
      return `¡Hola, ${studentName}! Continuemos con la lección.`;
  }
}

/**
 * Gets an encouragement phrase for when the student is inactive
 */
export function getEncouragementPhrase(
  config: LessonConfig | null,
  studentName: string | null,
): string {
  if (!config || !studentName || config.encouragementPhrases.length === 0) {
    return getFallbackEncouragement(studentName);
  }

  return getRandomItem(config.encouragementPhrases).replace('{studentName}', studentName);
}

/**
 * Gets a joke to lighten the mood
 */
export function getJoke(config: LessonConfig | null, studentName: string | null): string {
  if (!config || !studentName || config.jokes.length === 0) {
    return getFallbackJoke(studentName);
  }

  return getRandomItem(config.jokes).replace('{studentName}', studentName);
}

/**
 * Fallback greetings when no config is available
 */
function getFallbackGreeting(state: PedagogicalState): string {
  const fallbacks: Record<PedagogicalState, string> = {
    AWAITING_START: '¡Hola! Bienvenido a la clase de hoy.',
    ACTIVE_CLASS: '¡Hola! ¿Estás listo para aprender?',
    EXPLANATION: '¡Vamos! Veamos este concepto juntos.',
    QUESTION: '¡Adelante! Responde cuando estés listo.',
    EVALUATION: 'Revisemos lo que has aprendido.',
    RESOLVING_DOUBT: 'Estoy aquí para ayudarte con tu duda.',
    CLARIFYING: 'Vamos a aclarar este punto juntos.',
    COMPLETED: '¡Excelente trabajo! Has completado la lección.',
    ACTIVITY_WAIT: 'Preparando la siguiente actividad...',
    ACTIVITY_INACTIVITY_WARNING: '¿Necesitas ayuda con esta actividad?',
    ACTIVITY_SKIP_OFFER: '¿Qué prefieres hacer?',
    ACTIVITY_REPEAT: 'Repasemos este concepto juntos.',
  };

  return fallbacks[state] || '¡Hola! Continuemos con la lección.';
}

/**
 * Fallback encouragement phrases
 */
function getFallbackEncouragement(studentName: string | null): string {
  const name = studentName || 'amigo';
  const encouragements = [
    `¡Vamos, ${name}! Tú puedes hacerlo.`,
    `Confía en ti mismo, ${name}. Estoy aquí para ayudarte.`,
    `Cada intento te acerca más al éxito, ${name}.`,
    `¡Date un segundo, ${name}! Lo estás haciendo muy bien.`,
    `Recuerda, ${name}, equivocarse es parte de aprender.`,
  ];

  return getRandomItem(encouragements);
}

/**
 * Fallback jokes
 */
function getFallbackJoke(studentName: string | null): string {
  const name = studentName || 'amigo';
  const jokes = [
    `¿Por qué el libro de matemáticas estaba triste? Porque tenía demasiados problemas. ¡Ánimo, ${name}!`,
    `¿Cuál es el colmo de un electricista? Tener miedo a la luz. ¡Ja!`,
    `¿Qué le dice una pared a otra pared? Nos vemos en la esquina. ¡Ja ja!`,
    `¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter. ¡Pi pi!`,
    `¿Cuál es el animal más antiguo? La cebra, porque está en blanco y negro. ¡Ja ja ja!`,
  ];

  return getRandomItem(jokes);
}
