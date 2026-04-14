import type { RecipeStep } from './recipe.schema';

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
