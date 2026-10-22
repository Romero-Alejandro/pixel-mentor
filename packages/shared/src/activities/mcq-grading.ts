import type { ActivityOption } from '@/schemas/recipe/activity-option.schema.js';

// ==================== MCQ Grading (Fase 0) ====================
//
// Fase 0 of the activity-evolution plan: grade MCQ by option id instead of
// exact text matching. Text fallback keeps legacy clients working.

/** What the student picked. optionId is authoritative; text is legacy fallback. */
export interface McqResponse {
  optionId?: string;
  text?: string;
}

export interface McqGradeResult {
  isCorrect: boolean;
  /** True when the answer was resolved via the legacy text-matching path. */
  matchedByText: boolean;
  /** id of the correct option (for the client to reveal it after grading). */
  correctOptionId?: string;
  correctOptionText?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Grades an MCQ answer by option id, falling back to normalized text equality
 * when no optionId is provided (legacy clients) or the id is unknown.
 */
export function gradeMcq(
  options: readonly { id: string; text: string; isCorrect: boolean }[],
  response: McqResponse,
): McqGradeResult {
  const correctOption = options.find((o) => o.isCorrect);
  const correctOptionId = correctOption?.id;
  const correctOptionText = correctOption?.text;

  if (response.optionId) {
    const selected = options.find((o) => o.id === response.optionId);
    if (selected) {
      return {
        isCorrect: selected.isCorrect,
        matchedByText: false,
        correctOptionId,
        correctOptionText,
      };
    }
  }

  // Legacy fallback: exact text match against option texts.
  const text = typeof response.text === 'string' ? normalize(response.text) : '';
  const isCorrect =
    text.length > 0 &&
    correctOptionText !== undefined &&
    text === normalize(correctOptionText);

  return { isCorrect, matchedByText: true, correctOptionId, correctOptionText };
}

// ==================== Legacy script normalization ====================

/** Shape of pre-Fase-0 activity scripts (no option ids). */
export interface LegacyActivityScript {
  instruction?: string | { text?: string };
  options?: Array<{ text: string; isCorrect: boolean }>;
  feedback?: { correct?: string; incorrect?: string };
}

/** Stable id for an option, derived from its position. */
export function legacyOptionId(scriptId: string, index: number): string {
  return `${scriptId}-opt-${index}`;
}

/**
 * Normalizes a legacy { instruction, options } script into the id-carrying
 * mcq_single shape. Options without ids get stable derived ids so the same
 * script always maps to the same ids across requests.
 */
export function normalizeMcqScript(scriptId: string, script: unknown): {
  instruction: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  feedback: { correct: string; incorrect: string };
} | null {
  if (script === null || typeof script !== 'object') return null;
  const s = script as LegacyActivityScript;

  const instruction =
    typeof s.instruction === 'string'
      ? s.instruction
      : s.instruction && typeof s.instruction === 'object' && typeof s.instruction.text === 'string'
        ? s.instruction.text
        : undefined;

  const rawOptions = Array.isArray(s.options) ? s.options : [];
  if (!instruction || rawOptions.length === 0) return null;

  const options = rawOptions
    .filter((o): o is { text: string; isCorrect: boolean } => typeof o?.text === 'string')
    .map((o, i) => ({ id: legacyOptionId(scriptId, i), text: o.text, isCorrect: o.isCorrect === true }));

  return {
    instruction,
    options,
    feedback: {
      correct: s.feedback?.correct ?? '¡Correcto!',
      incorrect: s.feedback?.incorrect ?? 'Incorrecto.',
    },
  };
}
