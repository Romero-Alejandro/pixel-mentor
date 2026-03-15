# Recipe.meta Structure

The `Recipe.meta` field contains optional configuration and student-specific data that can be used to customize the tutoring experience. This structure allows for flexible configuration without requiring changes to the core recipe schema.

## TypeScript Interface

```typescript
interface RecipeMeta {
  config?: LessonConfig | null;
  studentName?: string | null;
}

interface LessonConfig {
  // Tutor identification
  tutorName: string;

  // Session limits
  maxQuestionsPerSession: number;          // Maximum questions allowed per session
  questionCooldownSeconds: number;         // Minimum seconds between questions

  // Activity timing
  activityTimeoutSeconds: number;          // Maximum time for an activity before warning
  encouragementAfterInactivitySeconds: number; // Time before showing encouragement
  skipAfterInactivitySeconds: number;      // Time before offering to skip activity

  # Activity attempts
  skipAfterFailedAttempts: number;         // Number of failed attempts before offering to skip

  # Features
  enableActivitySkip: boolean;             // Whether to allow skipping activities

  # Tone and style
  tone: 'friendly' | 'formal';             // Overall tone of interactions

  # Customizable greetings and messages
  greetings: {
    intro: string;                         // Initial greeting when starting lesson
    readyPrompt: string;                   // Prompt asking if student is ready
    nextConceptTransition: string;         // Message when moving to next concept
    completionMessage: string;             // Message when lesson is completed
  };

  # Customizable encouragement phrases
  encouragementPhrases: string[];          // Phrases used to encourage student

  # Customizable jokes for engagement
  jokes: string[];                         // Jokes used to lighten mood
}
```

## Default Values

If `Recipe.meta` or `Recipe.meta.config` is not provided, the system uses these default values:

```typescript
const DEFAULT_CONFIG: LessonConfig = {
  tutorName: 'Pixel Mentor',
  maxQuestionsPerSession: 10,
  questionCooldownSeconds: 30,
  activityTimeoutSeconds: 30,
  encouragementAfterInactivitySeconds: 10,
  skipAfterFailedAttempts: 3,
  skipAfterInactivitySeconds: 30,
  enableActivitySkip: true,
  tone: 'friendly',
  greetings: {
    intro: '¡Hola! Bienvenido a la clase de hoy.',
    readyPrompt: '¿Estás listo para aprender?',
    nextConceptTransition: '¡Vamos! Veamos este concepto juntos.',
    completionMessage: '¡Excelente trabajo! Has completado la lección.',
  },
  encouragementPhrases: [
    '¡Vamos! Tú puedes hacerlo.',
    'Confía en ti mismo. Estoy aquí para ayudarte.',
    'Cada intento te acerca más al éxito.',
    '¡Date un segundo! Lo estás haciendo muy bien.',
    'Recuerda, equivocarse es parte de aprender.',
  ],
  jokes: [
    '¿Por qué el libro de matemáticas estaba triste? Porque tenía demasiados problemas. ¡Ánimo!',
    '¿Cuál es el colmo de un electricista? Tener miedo a la luz. ¡Ja!',
    '¿Qué le dice una pared a otra pared? Nos vemos en la esquina. ¡Ja ja!',
    '¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter. ¡Pi pi!',
    '¿Cuál es el animal más antiguo? La cebra, porque está en blanco y negro. ¡Ja ja ja!',
  ],
};
```

## Usage in the System

### Backend

- The `meta` field is included in both `StartRecipeOutput` and `InteractRecipeOutput` schemas
- When starting a recipe, the backend can include custom configuration and student name in the `meta` field
- The configuration is merged with defaults (backend-provided values take precedence)

### Frontend

- The `useLessonStore` provides `config` and `studentName` state variables
- These are populated from the `Recipe.meta` when a lesson is started
- The configuration is used throughout the system for:
  - Customizing dialogue and greetings
  - Setting timing parameters for activities and questions
  - Controlling behavior like question limits and skip options
  - Personalizing the experience with the student's name

### Example Recipe.meta

```json
{
  "config": {
    "tutorName": "Professor Pixel",
    "maxQuestionsPerSession": 15,
    "questionCooldownSeconds": 25,
    "activityTimeoutSeconds": 40,
    "encouragementAfterInactivitySeconds": 15,
    "skipAfterFailedAttempts": 2,
    "skipAfterInactivitySeconds": 25,
    "enableActivitySkip": true,
    "tone": "friendly",
    "greetings": {
      "intro": "¡Hola, aventurero! Listo para explorar el conocimiento?",
      "readyPrompt": "¿Preparado para la próxima misión, explorador?",
      "nextConceptTransition": "¡Excelente! Continuemos nuestra aventura educativa.",
      "completionMessage": "¡Misión completada! Has demostrado gran valentía intelectual."
    },
    "encouragementPhrases": [
      "¡Vamos, campeona! Cada intento te hace más fuerte.",
      "Confía en tus habilidades. Estoy aquí para guiarte.",
      "Errores son solo oportunidades de aprendizaje disfrazadas.",
      "¡Date un respiro! Vas por muy buen camino.",
      "Recuerda: los grandes logros comienzan con pequeños intentos."
    ],
    "jokes": [
      "¿Por qué los programadores confunden Halloween y Navidad? Porque Oct 31 = Dec 25. ¡Ja ja!",
      "¿Cuál es el colmo de un desarrollador? Tener miedo a los bugs. ¡Ja!",
      "¿Qué le dice un bit a otro bit? Nos vemos en el byte. ¡Ja ja ja!",
      "¿Por qué las funciones son malas para contar secretos? Porque siempre llaman. ¡Ja ja!",
      "¿Cuál es el animal más antiguo en código? El bug, porque ha estado desde el principio. ¡Ja ja ja ja!"
    ]
  },
  "studentName": "Alejandro"
}
```

## Extending the Structure

To add new configuration options:

1. Add the field to the `LessonConfig` interface in `packages/shared/src/recipe.ts`
2. Add the corresponding Zod schema validation in `StartRecipeOutputSchema` and `InteractRecipeOutputSchema`
3. Update the default values in the frontend if needed
4. Use the new configuration in the appropriate places in the frontend/backend

## Best Practices

1. **Keep defaults sensible**: The default configuration should provide a good experience without customization
2. **Make all fields optional**: Allow partial configuration overrides
3. **Document all fields**: Clearly explain what each configuration option does
4. **Validate on both ends**: Use Zod schemas for backend validation and TypeScript for frontend safety
5. **Consider performance**: Avoid overly complex configurations that could impact performance
