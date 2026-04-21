import type { RecipeStep } from '../../recipe.js';

export type StepType = 'content' | 'activity' | 'question' | 'intro' | 'closure';

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  content: 'Contenido',
  activity: 'Actividad',
  question: 'Pregunta',
  intro: 'Intro',
  closure: 'Cierre',
};

export const STEP_TYPE_COLORS: Record<StepType, string> = {
  content: 'bg-sky-100 text-sky-700 border-sky-200',
  activity: 'bg-purple-100 text-purple-700 border-purple-200',
  question: 'bg-amber-100 text-amber-700 border-amber-200',
  intro: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closure: 'bg-rose-100 text-rose-700 border-rose-200',
};

const extractText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'text' in value) {
    return (value as { text: string }).text;
  }
  return '';
};

export const transformStepScript = (
  stepType: string,
  script: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!script) return undefined;

  if (stepType === 'activity' || stepType === 'question') {
    return script;
  }

  const contentText = extractText(script.content);

  return {
    transition:
      typeof script.transition === 'string' ? { text: script.transition } : script.transition,
    content:
      typeof script.content === 'string'
        ? { text: contentText, chunks: [{ text: contentText, pauseAfter: 500 }] }
        : script.content,
    examples: Array.isArray(script.examples)
      ? script.examples.map((e) => (typeof e === 'string' ? { text: e } : e))
      : [{ text: '' }],
    closure: typeof script.closure === 'string' ? { text: script.closure } : script.closure,
  };
};

export const getStepTitle = (step: RecipeStep): string => {
  const rawContent =
    step.script?.content || step.activity?.instruction || step.question?.question || '';

  const text = extractText(rawContent);
  const finalTitle = text.trim() || `Paso ${step.order}`;

  return finalTitle.length > 50 ? `${finalTitle.slice(0, 50)}...` : finalTitle;
};

// ==================== Step Data Normalization ====================

export interface StepDataInput {
  stepType?: StepType;
  script?: Record<string, unknown>;
  activity?: Record<string, unknown>;
  question?: Record<string, unknown>;
  order?: number;
  atomId?: string;
  conceptId?: string;
  activityId?: string;
}

/**
 * Normaliza datos de paso del formato UI al formato Zod.
 * El frontend envía datos en formato "UI" (script con kind), pero Zod espera campos separados.
 * Esta función detecta y normaliza ambos formatos.
 */
export function normalizeStepData(input: StepDataInput): StepDataInput {
  const { stepType, script, activity, question, ...rest } = input;

  // Si ya tiene activity o question como objetos separados, no necesita normalización
  if (activity || question) {
    return input;
  }

  // Detectar formato UI (script con kind) y normalizar
  if (script && typeof script === 'object' && 'kind' in script) {
    const kind = (script as { kind?: string }).kind;

    if (kind === 'activity') {
      // Normalizar activity desde formato UI - esquema espera strings, NO objetos {text}
      const instruction = extractText(script.instruction);
      const options = (script.options as Array<{ text: string; isCorrect: boolean }>) || [];
      const feedback = (script.feedback as Record<string, string>) || {};

      return {
        ...rest,
        stepType: stepType || 'activity',
        activity: {
          instruction, // string directo, NO {text: instruction}
          options: options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          feedback: {
            correct: feedback.correct || '¡Correcto!',
            incorrect: feedback.incorrect || 'Intenta de nuevo',
          },
        },
        script: undefined,
      };
    }

    if (kind === 'question') {
      // Normalizar question desde formato UI - esquema espera string para question
      const questionText = extractText(script.question);
      const expectedAnswer = (script.expectedAnswer as string) || '';
      const feedback = (script.feedback as Record<string, string>) || {};
      const hint = (script.hint as string) || '';

      return {
        ...rest,
        stepType: stepType || 'question',
        question: {
          question: questionText, // string directo, NO {text: questionText}
          answer: {
            question: questionText,
            expectedAnswer,
            feedback: {
              correct: feedback.correct || '¡Muy bien!',
              incorrect: feedback.incorrect || 'Casi, intentá de nuevo',
            },
          },
        },
        script: undefined,
      };
    }
  }

  // Normalizar campos de texto a objetos {text} para contenido/intro/closure
  if (stepType === 'content' || stepType === 'intro' || stepType === 'closure') {
    const normalized: StepDataInput = {
      ...rest,
      stepType,
      script: undefined,
    };

    if (script && typeof script === 'object') {
      normalized.script = {
        transition: { text: extractText(script.transition) || '¡Vamos!' },
        content: {
          text: extractText(script.content) || 'Contenido',
          chunks: [{ text: extractText(script.content) || 'Contenido', pauseAfter: 500 }],
        },
        examples: ((script.examples as Array<string | { text: string }>) || []).map((e) =>
          typeof e === 'string' ? { text: e } : e,
        ),
        closure: { text: extractText(script.closure) || '¡Muy bien!' },
      };
    }

    return normalized;
  }

  // Para activity sin formato UI, asegurar que activity tenga estructura válida
  if (stepType === 'activity' && script) {
    return {
      ...rest,
      stepType,
      activity: {
        instruction: { text: extractText(script.instruction) || 'Realiza la actividad' },
        options: [],
        feedback: { correct: '¡Correcto!', incorrect: 'Intenta de nuevo' },
      },
    };
  }

  // Para question sin formato UI
  if (stepType === 'question' && script) {
    return {
      ...rest,
      stepType,
      question: {
        question: { text: extractText(script.question) || '¿Qué aprendiste?' },
        expectedAnswer: { text: (script.expectedAnswer as string) || '' },
        feedback: { correct: '¡Correcto!', incorrect: 'Casi' },
      },
    };
  }

  return input;
}
