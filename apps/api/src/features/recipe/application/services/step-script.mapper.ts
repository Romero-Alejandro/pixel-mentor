import type { RecipeStep } from '@/features/recipe/domain/entities/recipe.entity.js';
import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';
import type { StaticContent, ActivityContent } from '@/shared/dto/index.js';
import { detectScriptFormat, type ActivityFormat } from '@pixel-mentor/shared/activities';

// Type for RAG service returned chunks with similarity scores
export type RAGChunk = {
  chunk: KnowledgeChunk;
  similarityScore: number;
  citations?: unknown[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Step script types (JSON auto-contenido embebido en cada paso)
// ─────────────────────────────────────────────────────────────────────────────

export type TextOrTextObject = string | { text: string };

export function extractText(val: TextOrTextObject | undefined | null): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'text' in val && typeof val.text === 'string') {
    return val.text;
  }
  return '';
}

export interface ContentScript {
  transition?: string;
  content?: string;
  examples?: string[];
  closure?: string;
}

export interface QuestionScript extends ContentScript {
  question: string; // Texto de la pregunta de comprensión
  expectedAnswer: string; // Respuesta esperada (para el evaluador LLM)
  hint?: string;
  feedback: { correct: string; incorrect: string };
}

export interface ActivityOption {
  /** Stable id (Fase 0 content). Legacy scripts omit it; `opt-<index>` is used then. */
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface ActivityScript extends ContentScript {
  instruction: string; // Enunciado del MCQ
  options: ActivityOption[];
  feedback: { correct: string; incorrect: string };
}

export function isQuestionScript(s: unknown): s is QuestionScript {
  const q = (s as QuestionScript)?.question;
  const opts = (s as ActivityScript)?.options;
  const inst = (s as ActivityScript)?.instruction;

  // If it has options, it's a multiple choice activity - use deterministic comparison
  if (Array.isArray(opts) && opts.length > 0) {
    return false;
  }

  // If it has instruction but no question, it's an activity without options
  if (inst && !q) {
    return false;
  }

  // Accept both string and {text: string} object
  return typeof q === 'string' || (typeof q === 'object' && q !== null && 'text' in q);
}

export function isActivityScript(s: unknown): s is ActivityScript {
  const opts = (s as ActivityScript)?.options;
  const inst = (s as ActivityScript)?.instruction;
  // Check if it has options OR has instruction (string or object)
  const hasInstruction =
    typeof inst === 'string' || (typeof inst === 'object' && inst !== null && 'text' in inst);
  return (Array.isArray(opts) && opts.length > 0) || hasInstruction;
}

/**
 * Safely reads the MCQ `options` array from a step script without casting at
 * the call site. Returns an empty array for null/undefined/malformed scripts
 * and for instruction-only activity scripts (which have no options).
 */
export function readScriptOptions(s: unknown): readonly ActivityOption[] {
  if (isActivityScript(s) && Array.isArray(s.options)) return s.options;
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Step classification helpers
// ─────────────────────────────────────────────────────────────────────────────

export function requiresStudentInput(stepType?: string | null): boolean {
  // Accept both string literals and Prisma enum values for backward compatibility
  const isActivity = stepType === 'activity' || stepType === 'ACTIVITY';
  const isQuestion = stepType === 'question' || stepType === 'QUESTION';
  const isExam = stepType === 'exam' || stepType === 'EXAM';
  return isActivity || isQuestion || isExam;
}

/**
 * Build an array of content-only steps for the frontend to auto-advance through.
 * Excludes question and activity steps which require student interaction.
 */
export function buildContentSteps(steps: readonly RecipeStep[]): Array<{
  stepIndex: number;
  stepType: 'content' | 'intro' | 'closure';
  staticContent: StaticContent;
}> {
  const result: Array<{
    stepIndex: number;
    stepType: 'content' | 'intro' | 'closure';
    staticContent: StaticContent;
  }> = [];
  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx];
    if (!requiresStudentInput(step.stepType)) {
      const sc = extractStaticContent(step);
      if (sc) {
        result.push({
          stepIndex: idx,
          stepType: (step.stepType ?? 'content') as 'content' | 'intro' | 'closure',
          staticContent: sc,
        });
      }
    }
  }
  return result;
}

export function findPreviousContentStep(steps: readonly RecipeStep[], from: number): number | null {
  for (let i = from - 1; i >= 0; i--) {
    if (!requiresStudentInput(steps[i].stepType)) return i;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee TODO el contenido del paso desde step.script (JSON auto-contenido).
 *
 * CORRECCIÓN CLAVE respecto a la versión anterior:
 *   - La versión anterior leía `step.activityId` → siempre undefined porque
 *     el campo no existe en el schema de Prisma.
 *   - Ahora leemos directamente de `step.script.options` / `step.script.question`,
 *     que están embebidos en el JSON del paso. Sin dependencias de FKs externas.
 */
export function extractStaticContent(step: {
  stepType?: string | null;
  script?: unknown;
}): StaticContent | undefined {
  const { stepType, script } = step;
  if (!stepType) return undefined;

  // Even if script is null/undefined, return a basic staticContent with stepType
  if (!script) {
    return {
      stepType: 'content' as const,
      script: {
        transition: '',
        content: '',
        examples: [],
        closure: '',
      },
    };
  }

  // Handle both lowercase strings and uppercase Prisma enum values for backward compatibility
  const isContent = stepType === 'content' || stepType === 'CONTENT';
  const isIntro = stepType === 'intro' || stepType === 'INTRO';
  const isClosure = stepType === 'closure' || stepType === 'CLOSURE';
  const isQuestion = stepType === 'question' || stepType === 'QUESTION';

  // ── Contenido / intro / closure ──────────────────────────────────────
  if (isContent || isIntro || isClosure) {
    const s = script as ContentScript;
    return {
      stepType: isContent ? 'content' : isIntro ? 'intro' : 'closure',
      script: {
        transition: s.transition ?? '',
        content: s.content ?? '',
        examples: s.examples ?? [],
        closure: s.closure ?? '',
      },
    };
  }

  // ── Pregunta de comprensión (respuesta libre) ─────────────────────────
  // Always respect stepType — type guard is only for extracting data
  if (isQuestion) {
    const questionText = isQuestionScript(script)
      ? extractText((script as QuestionScript).question)
      : '';
    const fb = isQuestionScript(script)
      ? (script as QuestionScript).feedback
      : { correct: '', incorrect: '' };
    const hint = isQuestionScript(script) ? (script as QuestionScript).hint : undefined;
    return {
      stepType: 'question', // Preserve original type for frontend routing
      script: {
        transition: extractText(
          isQuestionScript(script) ? (script as QuestionScript).transition : '',
        ),
        content: questionText,
        examples: [],
        closure: '',
      },
      activity: {
        instruction: questionText,
        options: undefined, // Explicitamente undefined para preguntas (sin opciones)
        feedback: {
          correct: fb.correct,
          incorrect: fb.incorrect,
          partial: hint,
        },
      },
    };
  }

  // ── Actividad / examen (opción múltiple) ──────────────────────────────
  // Always respect stepType — type guard is only for extracting data
  if (
    stepType === 'activity' ||
    stepType === 'exam' ||
    stepType === 'ACTIVITY' ||
    stepType === 'EXAM'
  ) {
    const instructionText = isActivityScript(script)
      ? extractText((script as ActivityScript).instruction)
      : '';
    // SECURITY: never ship `isCorrect` to the client — it leaked the answer in
    // the staticContent payload. Options go out as { id, text } only; grading
    // happens server-side and the reveal arrives via the end event's
    // `correctOptionId` after the student answers.
    const safeOptions =
      isActivityScript(script) && Array.isArray((script as ActivityScript).options)
        ? (script as ActivityScript).options.map((o, i) => ({
            id: o.id ?? `opt-${i}`,
            text: o.text,
          }))
        : [];
    const fb = isActivityScript(script)
      ? (script as ActivityScript).feedback
      : { correct: '', incorrect: '' };
    // Fase 1: format-aware transport. Formats with no `options` (true_false,
    // ordering) ship their UI payload through `activity.items` / `activity.answer`
    // (answerless by construction); mcq formats ship safe `{ id, text }` options.
    const format: ActivityFormat = detectScriptFormat(script);
    const rawScript = script as Record<string, unknown>;
    const formatItems = Array.isArray(rawScript.items)
      ? (rawScript.items as Array<{ id?: string; text: string }>).map((it, i) => ({
          id: it.id ?? `item-${i}`,
          text: it.text,
        }))
      : undefined;

    const activityPayload: ActivityContent = {
      instruction: instructionText,
      options: safeOptions.length > 0 ? safeOptions : undefined,
      items: formatItems,
      feedback: {
        correct: fb.correct ?? '',
        incorrect: fb.incorrect ?? '',
      },
    };

    return {
      stepType: 'activity',
      activityFormat: format,
      script: {
        transition: extractText(
          isActivityScript(script) ? (script as ActivityScript).transition : '',
        ),
        content: instructionText,
        examples: [],
        closure: extractText(isActivityScript(script) ? (script as ActivityScript).closure : ''),
      },
      activity: activityPayload,
    };
  }

  // Fallback
  const s = script as ContentScript;
  return {
    stepType: 'content',
    script: {
      transition: s.transition ?? '',
      content: s.content ?? '',
      examples: s.examples ?? [],
      closure: s.closure ?? '',
    },
  };
}

// ─── buildVoiceText ──────────────────────────────────────────────────────
export function buildVoiceText(step: { stepType?: string | null; script?: unknown }): string {
  const { stepType, script } = step;
  if (!script) return '';

  // Helper to extract text from either string or { text } object
  const txt = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (
      val &&
      typeof val === 'object' &&
      'text' in val &&
      typeof (val as { text: unknown }).text === 'string'
    ) {
      return (val as { text: string }).text;
    }
    return '';
  };

  if (stepType === 'question' && isQuestionScript(script)) {
    return [txt(script.transition), txt(script.question)].filter(Boolean).join(' ');
  }
  if (
    (stepType === 'activity' ||
      stepType === 'exam' ||
      stepType === 'ACTIVITY' ||
      stepType === 'EXAM') &&
    isActivityScript(script)
  ) {
    return [txt(script.transition), txt(script.instruction)].filter(Boolean).join(' ');
  }
  const s = script as ContentScript;
  return [txt(s.transition), txt(s.content), txt(s.closure)].filter(Boolean).join(' ');
}
