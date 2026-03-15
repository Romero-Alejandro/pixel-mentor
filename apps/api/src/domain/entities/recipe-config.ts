/**
 * Configuration interface for Recipe (Lesson) behavior
 * Defines all configurable aspects of the tutor's class flow
 */

export interface RecipeConfig {
  /** Name of the tutor bot */
  tutorName: string;
  
  /** Maximum number of questions allowed per session */
  maxQuestionsPerSession: number;
  
  /** Cooldown period between questions (in seconds) */
  questionCooldownSeconds: number;
  
  /** Timeout for activity responses (in seconds) */
  activityTimeoutSeconds: number;
  
  /** Time before showing encouragement message (in seconds) */
  encouragementAfterInactivitySeconds: number;
  
  /** Number of failed attempts before offering skip */
  skipAfterFailedAttempts: number;
  
  /** Timeout before offering skip option (in seconds) */
  skipAfterInactivitySeconds: number;
  
  /** Whether to enable the activity skip feature */
  enableActivitySkip: boolean;
  
  /** Tone of the tutor's dialogue */
  tone: 'friendly' | 'formal';
  
  /** Greeting and dialogue phrases */
  greetings: GreetingConfig;
  
  /** Encouragement phrases for when student is stuck */
  encouragementPhrases: string[];
  
  /** Simple jokes appropriate for children */
  jokes: string[];
}

/** Greeting configuration */
export interface GreetingConfig {
  /** Introduction phrase - supports {name}, {tutor}, {title} placeholders */
  intro: string;
  
  /** Prompt to ask if student is ready */
  readyPrompt: string;
  
  /** Transition phrase between concepts */
  nextConceptTransition: string;
  
  /** Completion message */
  completionMessage: string;
}

/** Default configuration values */
export const DEFAULT_CONFIG: RecipeConfig = {
  tutorName: 'Tutor',
  maxQuestionsPerSession: 10,
  questionCooldownSeconds: 30,
  activityTimeoutSeconds: 30,
  encouragementAfterInactivitySeconds: 10,
  skipAfterFailedAttempts: 3,
  skipAfterInactivitySeconds: 30,
  enableActivitySkip: true,
  tone: 'friendly',
  greetings: {
    intro: '¡Hola {name}! Soy {tutor}. Hoy vamos a aprender sobre {title}',
    readyPrompt: '¿Estás listo para comenzar?',
    nextConceptTransition: 'Ahora vamos a aprender sobre {conceptTitle}',
    completionMessage: '¡Has terminado la clase de {title}! ¡Felicitaciones {name}!',
  },
  encouragementPhrases: [
    '¡Tú puedes!',
    'Piénsalo un poco más',
    '¡Ánimo!',
    'No te rindas, estás haciendo great job!',
    'Las respuestas difíciles hacen a los campeones.',
  ],
  jokes: [
    '¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
    '¿Por qué el libro de matemáticas estaba triste? Porque tenía muchos problemas.',
    '¿Qué le dice un jaguar a otro? Jaguar you?',
    '¿Cómo se dice pañuelo en japonés? Saka-moko',
    '¿Qué hace una gallina en un techno? Baila el chicken.',
  ],
};

/**
 * Parse recipe metadata into RecipeConfig
 * Falls back to defaults if metadata is missing or invalid
 */
export function parseRecipeConfig(meta: Record<string, unknown> | null | undefined): RecipeConfig {
  if (!meta) {
    return DEFAULT_CONFIG;
  }

  try {
    return {
      tutorName: typeof meta.tutorName === 'string' ? meta.tutorName : DEFAULT_CONFIG.tutorName,
      maxQuestionsPerSession: typeof meta.maxQuestionsPerSession === 'number' 
        ? meta.maxQuestionsPerSession 
        : DEFAULT_CONFIG.maxQuestionsPerSession,
      questionCooldownSeconds: typeof meta.questionCooldownSeconds === 'number'
        ? meta.questionCooldownSeconds
        : DEFAULT_CONFIG.questionCooldownSeconds,
      activityTimeoutSeconds: typeof meta.activityTimeoutSeconds === 'number'
        ? meta.activityTimeoutSeconds
        : DEFAULT_CONFIG.activityTimeoutSeconds,
      encouragementAfterInactivitySeconds: typeof meta.encouragementAfterInactivitySeconds === 'number'
        ? meta.encouragementAfterInactivitySeconds
        : DEFAULT_CONFIG.encouragementAfterInactivitySeconds,
      skipAfterFailedAttempts: typeof meta.skipAfterFailedAttempts === 'number'
        ? meta.skipAfterFailedAttempts
        : DEFAULT_CONFIG.skipAfterFailedAttempts,
      skipAfterInactivitySeconds: typeof meta.skipAfterInactivitySeconds === 'number'
        ? meta.skipAfterInactivitySeconds
        : DEFAULT_CONFIG.skipAfterInactivitySeconds,
      enableActivitySkip: typeof meta.enableActivitySkip === 'boolean'
        ? meta.enableActivitySkip
        : DEFAULT_CONFIG.enableActivitySkip,
      tone: meta.tone === 'formal' ? 'formal' : DEFAULT_CONFIG.tone,
      greetings: parseGreetingConfig(meta.greetings),
      encouragementPhrases: parseStringArray(meta.encouragementPhrases) || DEFAULT_CONFIG.encouragementPhrases,
      jokes: parseStringArray(meta.jokes) || DEFAULT_CONFIG.jokes,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Parse greeting configuration with defaults */
function parseGreetingConfig(greetings: unknown): GreetingConfig {
  if (!greetings || typeof greetings !== 'object') {
    return DEFAULT_CONFIG.greetings;
  }

  const g = greetings as Record<string, unknown>;
  return {
    intro: typeof g.intro === 'string' ? g.intro : DEFAULT_CONFIG.greetings.intro,
    readyPrompt: typeof g.readyPrompt === 'string' ? g.readyPrompt : DEFAULT_CONFIG.greetings.readyPrompt,
    nextConceptTransition: typeof g.nextConceptTransition === 'string' 
      ? g.nextConceptTransition 
      : DEFAULT_CONFIG.greetings.nextConceptTransition,
    completionMessage: typeof g.completionMessage === 'string' 
      ? g.completionMessage 
      : DEFAULT_CONFIG.greetings.completionMessage,
  };
}

/** Parse string array from unknown */
function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Fill placeholders in a template string
 * Supported placeholders: {name}, {tutor}, {title}, {conceptTitle}
 */
export function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);
}

/**
 * Get a random encouragement phrase
 */
export function getRandomEncouragement(config: RecipeConfig): string {
  const phrases = config.encouragementPhrases;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Get a random joke
 */
export function getRandomJoke(config: RecipeConfig): string {
  const jokes = config.jokes;
  return jokes[Math.floor(Math.random() * jokes.length)];
}
