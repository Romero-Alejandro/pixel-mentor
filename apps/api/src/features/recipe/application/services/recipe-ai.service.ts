/**
 * Recipe AI Application Service
 *
 * Provides AI-powered features for recipe/unidad creation.
 */

import { createLogger } from '@/shared/logger/logger.js';

import type { AIService } from '@/features/recipe/domain/ports/ai-service.port';

// Create a logger for RecipeAI service
const recipeAILogger = createLogger(undefined, { name: 'recipe-ai', level: 'debug' });

// ==================== DTOs ====================

export interface GenerateRecipeDraftInput {
  topic: string;
  learningObjectives?: string[];
  targetAgeMin: number;
  targetAgeMax: number;
}

export interface GeneratedStep {
  order: number;
  stepType: 'intro' | 'content' | 'activity' | 'closure' | 'question';
  title: string;
  script: {
    transition?: { text: string };
    content?: { text: string; chunks: Array<{ text: string; pauseAfter: number }> };
    examples?: Array<{ text: string; visual?: { type: string; src: string } }>;
    closure?: { text: string };
    instruction?: { text: string } | string;
    kind?: string;
    options?: Array<{ text: string; isCorrect: boolean }>;
    question?: { text: string } | string;
    expectedAnswer?: string;
    hint?: { text: string } | string;
    feedback?: {
      correct: string;
      incorrect: string;
      partial?: string;
    };
  };
}

export interface GeneratedRecipeDraft {
  title: string;
  description: string;
  expectedDurationMinutes: number;
  steps: GeneratedStep[];
  qualityValidation?: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ==================== AI Service ====================

export class RecipeAIService {
  constructor(private aiService: AIService) {}

  async generateRecipeDraft(input: GenerateRecipeDraftInput): Promise<GeneratedRecipeDraft> {
    const prompt = this.buildRecipeGenerationPrompt(input);
    recipeAILogger.debug({ promptLength: prompt.length }, '[RecipeAI] Calling AI');

    try {
      const response = await this.aiService.generateAnswer({
        question: prompt,
        context: '',
        recipeTitle: 'Generador de Unidades Pedagógicas',
      });

      recipeAILogger.debug(
        { responseLength: response.answer.length },
        '[RecipeAI] AI response received',
      );
      return this.parseAIResponse(response.answer, input);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      recipeAILogger.error({ err: errorMessage }, '[RecipeAI] AI generation error');
      return this.generateFallbackDraft(input);
    }
  }

  private buildRecipeGenerationPrompt(input: GenerateRecipeDraftInput): string {
    const objectives = input.learningObjectives?.join(', ') || 'No especificados';
    const ageRange = `${input.targetAgeMin}-${input.targetAgeMax} años`;

    return `# GENERADOR DE UNIDADES PEDAGÓGICAS

Eres un EXPERTO EN PEDAGOGÍA para niños de ${ageRange}.
Tu misión es crear UNA UNIDAD EDUCATIVA DE CALIDAD sobre: "${input.topic}"

## OBJETIVOS:
${objectives}

## REGLAS IMPORTANTES:

1. **Actividades (activity)**: Debe tener instruction como OBJETO {text: "..."}, opciones (options) y feedback
2. **Preguntas (question)**: Debe tener question como OBJETO {text: "..."}, expectedAnswer y feedback  
3. **Contenido (content)**: transition, content, examples, closure

## ESTRUCTURA (6-7 pasos):

### Paso 1: INTRO
### Pasos 2-3: CONTENT (explicación)
### Paso 4: ACTIVITY (opciones múltiples)
### Paso 5: QUESTION (pregunta abierta)
### Paso 6: CONTENT (profundización)
### Paso 7: CIERRE

## FORMATO ACTIVITY (IMPORTANTE):
{
  "order": 4,
  "stepType": "activity",
  "script": {
    "kind": "activity",
    "instruction": { "text": "Instrucción clara" },
    "options": [
      {"text": "Correcta", "isCorrect": true},
      {"text": "Incorrecta1", "isCorrect": false},
      {"text": "Incorrecta2", "isCorrect": false}
    ],
    "feedback": {
      "correct": "¡Muy bien! Explicación específica",
      "incorrect": "No. Pista breve."
    }
  }
}

## FORMATO QUESTION:
{
  "order": 5,
  "stepType": "question", 
  "script": {
    "kind": "question",
    "question": { "text": "¿Pregunta breve?" },
    "expectedAnswer": "Respuesta",
    "feedback": {
      "correct": "¡Correcto!",
      "incorrect": "Pista"
    }
  }
}

## EJEMPLO "LAS VOCALES":
{
  "steps": [
    {"order":1,"stepType":"intro","title":"¡Hola!","script":{"transition":{"text":"¡Hola! ¿Sabías que hay letras mágicas?"},"content":{"text":"Hoy vamos a aprender las vocales"},"closure":{"text":"¡Vamos!"}}},
    {"order":2,"stepType":"content","title":"La A","script":{"transition":{"text":"Conozcamos la A"},"content":{"text":"La A es como una montaña. Su sonido es fuerte.","chunks":[{"text":"La A es como una montaña",500}]},"examples":[{"text":"MANZANA tiene A"}],"closure":{"text":"¡Muy bien!"}}},
    {"order":3,"stepType":"activity","title":"¿Qué vocal?","script":{"kind":"activity","instruction":{"text":"¿Qué vocal tiene MANZANA?"},"options":[{"text":"A","isCorrect":true},{"text":"E","isCorrect":false},{"text":"I","isCorrect":false}],"feedback":{"correct":"¡Exacto! MANZANA tiene A","incorrect":"Pista: es la primera letra"}}},
    {"order":4,"stepType":"question","title":"¿Qué aprendimos?","script":{"kind":"question","question":{"text":"¿Cuántas vocales hay?"},"expectedAnswer":"Cinco","feedback":{"correct":"¡ Correcto!","incorrect":"Pista: A,E,I,O,U"}}},
    {"order":5,"stepType":"closure","title":"¡Fin!","script":{"transition":{"text":"¡Felicidades!"},"content":{"text":"Ahora conoces las vocales","chunks":[{"text":"Conoces las vocales",500}]},"closure":{"text":"¡Eres un experto!"}}}
  ]
}

Devuelve SOLO JSON válido.`;
  }

  private parseAIResponse(
    aiResponse: string,
    input: GenerateRecipeDraftInput,
  ): GeneratedRecipeDraft {
    let cleanedResponse = aiResponse.trim();
    if (cleanedResponse.startsWith('```json')) cleanedResponse = cleanedResponse.slice(7);
    if (cleanedResponse.startsWith('```')) cleanedResponse = cleanedResponse.slice(3);
    if (cleanedResponse.endsWith('```')) cleanedResponse = cleanedResponse.slice(0, -3);
    cleanedResponse = cleanedResponse.trim();

    try {
      const parsed = JSON.parse(cleanedResponse);
      return this.sanitizeRecipeDraft(parsed, input);
    } catch {
      return this.generateFallbackDraft(input);
    }
  }

  private sanitizeRecipeDraft(
    parsed: Record<string, unknown>,
    input: GenerateRecipeDraftInput,
  ): GeneratedRecipeDraft {
    const title = typeof parsed.title === 'string' ? parsed.title : `Aprende sobre ${input.topic}`;
    const description =
      typeof parsed.description === 'string' ? parsed.description : `Unidad sobre ${input.topic}`;
    const expectedDuration =
      typeof parsed.expectedDurationMinutes === 'number' ? parsed.expectedDurationMinutes : 30;

    let steps: GeneratedStep[] = [];
    if (Array.isArray(parsed.steps)) {
      steps = parsed.steps
        .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
        .map((s, index) => ({
          order: typeof s.order === 'number' ? s.order : index + 1,
          stepType: this.validateStepType(s.stepType),
          title: typeof s.title === 'string' ? s.title : `Paso ${index + 1}`,
          script: this.validateScript(s.script, s.stepType),
        }));
    }

    if (steps.length < 3) {
      steps = this.generateEnhancedFallbackSteps(
        input.topic,
        `${input.targetAgeMin}-${input.targetAgeMax}`,
      );
    }

    const qv = parsed.qualityValidation as
      | { passed?: boolean; errors?: string[]; warnings?: string[] }
      | undefined;
    const qualityValidation = qv
      ? {
          passed: Boolean(qv.passed),
          errors: Array.isArray(qv.errors) ? qv.errors : [],
          warnings: Array.isArray(qv.warnings) ? qv.warnings : [],
        }
      : { passed: true, errors: [], warnings: [] };

    return {
      title,
      description,
      expectedDurationMinutes: expectedDuration,
      steps,
      qualityValidation,
    };
  }

  private validateStepType(
    type: unknown,
  ): 'intro' | 'content' | 'activity' | 'closure' | 'question' {
    const validTypes = ['intro', 'content', 'activity', 'closure', 'question'];
    if (typeof type === 'string' && validTypes.includes(type))
      return type as 'intro' | 'content' | 'activity' | 'closure' | 'question';
    return 'content';
  }

  private validateScript(script: unknown, stepType: unknown): GeneratedStep['script'] {
    if (!script || typeof script !== 'object') return this.getDefaultScript(stepType);
    const s = script as Record<string, unknown>;

    // Activity: asegurar options
    if (stepType === 'activity') {
      const instruction = s.instruction;
      let instructionObj = { text: 'Realiza la actividad' };
      if (typeof instruction === 'string') instructionObj = { text: instruction };
      else if (instruction && typeof instruction === 'object') {
        const i = instruction as { text?: string };
        instructionObj = { text: i.text || 'Realiza la actividad' };
      }

      const options = s.options as Array<{ text?: string; isCorrect?: boolean }> | undefined;
      let optionsArr: Array<{ text: string; isCorrect: boolean }> = [];
      if (Array.isArray(options) && options.length > 0) {
        optionsArr = options.map((o) => ({
          text: o?.text || 'Opción',
          isCorrect: Boolean(o?.isCorrect),
        }));
      }
      if (optionsArr.length === 0 || !optionsArr.some((o) => o.isCorrect)) {
        optionsArr = [
          { text: 'Respuesta correcta', isCorrect: true },
          { text: 'Opción incorrecta 1', isCorrect: false },
          { text: 'Opción incorrecta 2', isCorrect: false },
        ];
      }

      const feedback = (s.feedback as Record<string, string>) || {};
      return {
        kind: 'activity',
        instruction: instructionObj,
        options: optionsArr,
        feedback: {
          correct: feedback.correct || '¡Muy bien!',
          incorrect: feedback.incorrect || 'Intenta de nuevo',
        },
      };
    }

    // Question
    if (stepType === 'question') {
      const question = s.question;
      let questionObj = { text: '¿Qué aprendiste?' };
      if (typeof question === 'string') questionObj = { text: question };
      else if (question && typeof question === 'object') {
        const q = question as { text?: string };
        questionObj = { text: q.text || '¿Qué aprendiste?' };
      }

      const feedback = (s.feedback as Record<string, string>) || {};
      const expectedAnswer = (s.expectedAnswer as string) || 'Una respuesta';

      return {
        kind: 'question',
        question: questionObj,
        expectedAnswer,
        feedback: {
          correct: feedback.correct || '¡Correcto!',
          incorrect: feedback.incorrect || 'Pista: piensa en el tema',
        },
      };
    }

    return script as GeneratedStep['script'];
  }

  private getDefaultScript(stepType: unknown): GeneratedStep['script'] {
    if (stepType === 'activity') {
      return {
        kind: 'activity',
        instruction: { text: 'Realiza la actividad' },
        options: [
          { text: 'Opción A', isCorrect: true },
          { text: 'Opción B', isCorrect: false },
        ],
        feedback: { correct: '¡Muy bien!', incorrect: 'Intenta de nuevo' },
      };
    }
    if (stepType === 'question') {
      return {
        kind: 'question',
        question: { text: '¿Qué aprendiste?' },
        expectedAnswer: 'Una respuesta',
        feedback: { correct: '¡Correcto!', incorrect: 'Pista: pensa en...' },
      };
    }
    return { content: { text: 'Contenido', chunks: [{ text: 'Contenido', pauseAfter: 500 }] } };
  }

  private generateFallbackDraft(input: GenerateRecipeDraftInput): GeneratedRecipeDraft {
    const topic = input.topic;
    const ageRange = `${input.targetAgeMin}-${input.targetAgeMax}`;
    return {
      title: `Aprende sobre ${topic}`,
      description: `Unidad sobre ${topic} para niños de ${ageRange}`,
      expectedDurationMinutes: 35,
      steps: this.generateEnhancedFallbackSteps(topic, ageRange),
      qualityValidation: { passed: true, errors: [], warnings: ['Plantilla mejorada'] },
    };
  }

  private generateEnhancedFallbackSteps(topic: string, _ageRange: string): GeneratedStep[] {
    const examples = this.getTopicExamples(topic);
    return [
      {
        order: 1,
        stepType: 'intro',
        title: '¡Descubre!',
        script: {
          transition: { text: `¡Hola! Vamos a aprender sobre ${topic}` },
          content: {
            text: `Hoy exploraremos ${topic}`,
            chunks: [{ text: `Exploraremos ${topic}`, pauseAfter: 500 }],
          },
          closure: { text: '¡Vamos!' },
        },
      },
      {
        order: 2,
        stepType: 'content',
        title: '¿Qué es?',
        script: {
          transition: { text: 'Conozcamos más...' },
          content: {
            text: examples.concept || `${topic} es interesante`,
            chunks: [{ text: examples.concept || `${topic}`, pauseAfter: 500 }],
          },
          examples: examples.list,
          closure: { text: '¡Excelente!' },
        },
      },
      {
        order: 3,
        stepType: 'content',
        title: 'Más detalles',
        script: {
          transition: { text: '¡Muy bien!' },
          content: {
            text: examples.detail || `Ahora sabes más sobre ${topic}`,
            chunks: [{ text: examples.detail || `Más sobre ${topic}`, pauseAfter: 500 }],
          },
          examples: examples.list2,
          closure: { text: '¡Perfecto!' },
        },
      },
      {
        order: 4,
        stepType: 'activity',
        title: '¡Practica!',
        script: examples.activity || {
          kind: 'activity',
          instruction: { text: `¿Qué aprendiste sobre ${topic}?` },
          options: [
            { text: 'Respuesta correcta', isCorrect: true },
            { text: 'Opción incorrecta', isCorrect: false },
            { text: 'Otra opción', isCorrect: false },
          ],
          feedback: { correct: '¡Muy bien!', incorrect: 'Intenta de nuevo' },
        },
      },
      {
        order: 5,
        stepType: 'question',
        title: '¿Qué aprendimos?',
        script: {
          kind: 'question',
          question: { text: `¿Qué sabes ahora de ${topic}?` },
          expectedAnswer: 'Algo aprendido',
          feedback: { correct: '¡Correcto!', incorrect: 'Piensa en lo que aprendiste' },
        },
      },
      {
        order: 6,
        stepType: 'content',
        title: 'Repaso',
        script: {
          transition: { text: '¡Excelente!' },
          content: {
            text: `Hoy aprendiste sobre ${topic}`,
            chunks: [{ text: `Aprendiste sobre ${topic}`, pauseAfter: 500 }],
          },
          closure: { text: '¡Sigue aprendiendo!' },
        },
      },
      {
        order: 7,
        stepType: 'closure',
        title: '¡Lo lograste!',
        script: {
          transition: { text: '¡Felicidades!' },
          content: {
            text: `Ahora sabes sobre ${topic}. ¡Sigue explorando!`,
            chunks: [{ text: `Sabes sobre ${topic}`, pauseAfter: 500 }],
          },
          closure: { text: '¡Eres un gran estudiante!' },
        },
      },
    ];
  }

  private getTopicExamples(topic: string): {
    concept?: string;
    detail?: string;
    list: Array<{ text: string }>;
    list2: Array<{ text: string }>;
    activity?: GeneratedStep['script'];
  } {
    const t = topic.toLowerCase();

    const examples: Record<
      string,
      {
        concept?: string;
        detail?: string;
        list: Array<{ text: string }>;
        list2: Array<{ text: string }>;
        activity?: GeneratedStep['script'];
      }
    > = {
      'las vocales': {
        concept: 'Las vocales son las estrellas del idioma: A, E, I, O, U.',
        detail: 'La A es como una montaña, la E como una puerta abierta.',
        list: [{ text: 'MANZANA tiene A' }, { text: 'CASA tiene A' }],
        list2: [{ text: 'ELEFANTE tiene E' }, { text: 'PEDRO tiene E' }],
        activity: {
          kind: 'activity',
          instruction: { text: '¿Qué vocal tiene MANZANA?' },
          options: [
            { text: 'A', isCorrect: true },
            { text: 'E', isCorrect: false },
            { text: 'I', isCorrect: false },
          ],
          feedback: {
            correct: '¡Exacto! MANZANA tiene A',
            incorrect: 'Pista: es la primera letra',
          },
        },
      },
      'el sol': {
        concept: 'El Sol es una estrella que nos da luz y calor.',
        detail: 'El Sol es tan grande que caben millones de planetas dentro.',
        list: [{ text: 'Nos da luz' }, { text: 'Nos da calor' }],
        list2: [{ text: 'Es una estrella' }, { text: 'Da energía a la Tierra' }],
        activity: {
          kind: 'activity',
          instruction: { text: '¿Qué nos da el Sol?' },
          options: [
            { text: 'Luz y calor', isCorrect: true },
            { text: 'Lluvia', isCorrect: false },
            { text: 'Frío', isCorrect: false },
          ],
          feedback: { correct: '¡Exacto!', incorrect: 'Pista: lo sientes cuando sales afuera' },
        },
      },
      'los animales': {
        concept: 'Los animales son seres vivos que se mueven, comen y respiran.',
        detail: 'Hay animales domésticos y salvajes.',
        list: [{ text: 'El perro es doméstico' }, { text: 'El león es salvaje' }],
        list2: [{ text: 'Los peces nadan' }, { text: 'Los pájaros vuelan' }],
        activity: {
          kind: 'activity',
          instruction: { text: '¿Cuál es doméstico?' },
          options: [
            { text: 'Perro', isCorrect: true },
            { text: 'León', isCorrect: false },
            { text: 'Tigre', isCorrect: false },
          ],
          feedback: { correct: '¡Muy bien!', incorrect: 'Pista: vive en casa' },
        },
      },
      'las sumas': {
        concept: 'Sumar es juntar números para obtener un resultado mayor.',
        detail: '2 + 3 = 5 significa que juntamos 2 y 3.',
        list: [{ text: '2 + 3 = 5' }, { text: '1 + 4 = 5' }],
        list2: [{ text: '5 + 1 = 6' }, { text: '2 + 2 = 4' }],
        activity: {
          kind: 'activity',
          instruction: { text: '¿Cuánto es 2 + 3?' },
          options: [
            { text: '5', isCorrect: true },
            { text: '4', isCorrect: false },
            { text: '6', isCorrect: false },
          ],
          feedback: { correct: '¡Exacto! 2 + 3 = 5', incorrect: 'Pista: cuenta 2 y suma 3' },
        },
      },
    };

    for (const key of Object.keys(examples)) {
      if (t.includes(key)) return examples[key];
    }

    return {
      list: [{ text: `Ejemplo de ${topic}` }, { text: `Otro ejemplo` }],
      list2: [{ text: 'Otro' }, { text: 'Más' }],
    };
  }
}
