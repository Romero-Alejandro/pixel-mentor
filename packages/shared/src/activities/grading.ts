import {
  type ActivityFormat,
  type ActivityGradeResult,
  type ActivityGrader,
  type ActivityScriptLike,
  LEGACY_FORMAT,
} from './formats.js';

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
export function normalizeMcqScript(
  scriptId: string,
  script: unknown,
): {
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

// ==================== mcq_single grader (Fase 0 behavior, moved here) ====================

export interface McqOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface McqSingleScript extends ActivityScriptLike {
  instruction: string;
  options: readonly McqOption[];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export interface McqGradeResult {
  isCorrect: boolean;
  matchedByText: boolean;
  correctOptionId?: string;
  correctOptionText?: string;
  feedback: string;
}

export const mcqSingleGrader: ActivityGrader<McqSingleScript, McqGradeResult> = {
  format: 'mcq_single',
  matchesScript: (script): script is McqSingleScript => {
    const s = script as McqSingleScript | null;
    return (
      typeof s === 'object' &&
      s !== null &&
      Array.isArray(s.options) &&
      s.options.length > 0 &&
      s.options.every((o) => typeof o === 'object' && o !== null && typeof o.id === 'string')
    );
  },
  grade: (script, context) => {
    const options = script.options;
    const correctOption = options.find((o) => o.isCorrect);
    const correctOptionId = correctOption?.id;
    const correctOptionText = correctOption?.text;

    if (context.optionId) {
      const selected = options.find((o) => o.id === context.optionId);
      if (selected) {
        return {
          isCorrect: selected.isCorrect,
          matchedByText: false,
          correctOptionId,
          correctOptionText,
          feedback: selected.isCorrect ? fbCorrect(script) : fbIncorrect(script),
        };
      }
    }

    // Legacy fallback: exact text match against option texts.
    const text = typeof context.studentInput === 'string' ? normalizeText(context.studentInput) : '';
    const isCorrect =
      text.length > 0 &&
      correctOptionText !== undefined &&
      text === normalizeText(correctOptionText);

    return {
      isCorrect,
      matchedByText: true,
      correctOptionId,
      correctOptionText,
      feedback: isCorrect ? fbCorrect(script) : fbIncorrect(script),
    };
  },
};

// ==================== mcq_multi grader ====================

export const mcqMultiGrader: ActivityGrader<McqSingleScript> = {
  format: 'mcq_multi',
  matchesScript: mcqSingleGrader.matchesScript,
  grade: (script, context) => {
    const options = script.options;
    const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
    const correctSet = new Set(correctIds);

    // Candidate sets: structured payload first, then a comma/space separated
    // free-text answer of option texts (voice fallback).
    let selectedIds: string[] = [];
    if (context.structured?.format === 'mcq_multi') {
      selectedIds = context.structured.optionIds.filter((id) =>
        options.some((o) => o.id === id),
      );
    } else if (typeof context.studentInput === 'string' && context.studentInput.trim()) {
      const text = normalizeText(context.studentInput);
      selectedIds = options
        .filter((o) => text.includes(normalizeText(o.text)))
        .map((o) => o.id);
    }

    const hits = selectedIds.filter((id) => correctSet.has(id)).length;
    const misses = selectedIds.length - hits;
    // Fraction of correct pairs, penalized by wrong selections (min 0).
    const score =
      correctIds.length > 0
        ? Math.max(0, (hits - misses) / correctIds.length)
        : 0;
    const isCorrect = correctIds.length > 0 && hits === correctIds.length && misses === 0;

    return {
      isCorrect,
      score,
      feedback: isCorrect ? fbCorrect(script) : fbPartial(script),
      correctAnswer: correctIds,
    };
  },
};

// ==================== true_false grader ====================

export interface TrueFalseScript extends ActivityScriptLike {
  instruction: string;
  /** The asserted truth value the student must confirm or refute. */
  answer: boolean;
}

export const trueFalseGrader: ActivityGrader<TrueFalseScript> = {
  format: 'true_false',
  matchesScript: (script): script is TrueFalseScript => {
    const s = script as TrueFalseScript | null;
    return typeof s === 'object' && s !== null && typeof s.answer === 'boolean' && !Array.isArray(s.options);
  },
  grade: (script, context) => {
    let value: boolean | undefined;
    if (context.structured?.format === 'true_false') {
      value = context.structured.value;
    } else {
      const t = normalizeText(String(context.studentInput ?? ''));
      if (/^(verdadero|true|v|cierto|correcto)$/.test(t)) value = true;
      else if (/^(falso|false|f|incorrecto)$/.test(t)) value = false;
    }

    const isCorrect = value !== undefined && value === script.answer;
    return {
      isCorrect,
      feedback: isCorrect ? fbCorrect(script) : fbIncorrect(script),
      correctAnswer: script.answer,
    };
  },
};

// ==================== ordering grader ====================

export interface OrderingItem {
  id: string;
  text: string;
}

export interface OrderingScript extends ActivityScriptLike {
  instruction: string;
  /** Items in the CORRECT order. */
  items: readonly OrderingItem[];
}

export interface OrderingGradeResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
  /** ids the student placed correctly, for per-item reveal. */
  correctPositions: boolean[];
  correctAnswer: string[];
}

export const orderingGrader: ActivityGrader<OrderingScript, OrderingGradeResult> = {
  format: 'ordering',
  matchesScript: (script): script is OrderingScript => {
    const s = script as OrderingScript | null;
    return (
      typeof s === 'object' &&
      s !== null &&
      Array.isArray(s.items) &&
      s.items.length > 1 &&
      s.items.every(
        (it) => typeof it === 'object' && it !== null && typeof it.id === 'string' && typeof it.text === 'string',
      )
    );
  },
  grade: (script, context) => {
    const expected = script.items.map((it) => it.id);

    let submitted: string[] = [];
    if (context.structured?.format === 'ordering') {
      submitted = context.structured.itemIds;
    } else if (typeof context.studentInput === 'string' && context.studentInput.trim()) {
      // Voice fallback: find the order in which item texts appear in the input.
      const text = normalizeText(context.studentInput);
      const found: Array<{ id: string; index: number }> = [];
      for (const it of script.items) {
        const idx = text.indexOf(normalizeText(it.text));
        if (idx >= 0) found.push({ id: it.id, index: idx });
      }
      submitted = found.sort((a, b) => a.index - b.index).map((f) => f.id);
    }

    // Items whose relative order matches the expected sequence. Positions are
    // compared by rank so a missing item doesn't shift everything to wrong.
    const rank = new Map<string, number>(expected.map((id, i) => [id, i]));
    const filtered = submitted.filter((id) => rank.has(id));
    const expectedSubsequence = [...filtered].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
    const correctPositions = filtered.map((id, i) => expectedSubsequence[i] === id);

    const correctCount = correctPositions.filter(Boolean).length;
    const score = expected.length > 0 ? correctCount / expected.length : 0;
    const isCorrect = submitted.length === expected.length && correctCount === expected.length;

    return {
      isCorrect,
      score,
      feedback: isCorrect ? fbCorrect(script) : fbPartial(script),
      correctPositions,
      correctAnswer: expected,
    };
  },
};

// ==================== Grader registry ====================

const GRADERS: ReadonlyMap<ActivityFormat, ActivityGrader<ActivityScriptLike, ActivityGradeResult>> =
  new Map([
    ['mcq_single', mcqSingleGrader as unknown as ActivityGrader<ActivityScriptLike, ActivityGradeResult>],
    ['mcq_multi', mcqMultiGrader as unknown as ActivityGrader<ActivityScriptLike, ActivityGradeResult>],
    ['true_false', trueFalseGrader as unknown as ActivityGrader<ActivityScriptLike, ActivityGradeResult>],
    ['ordering', orderingGrader as unknown as ActivityGrader<ActivityScriptLike, ActivityGradeResult>],
  ]);

/** Resolves the grader plugin for a format. Returns undefined for unknown ones. */
export function getGrader(format: ActivityFormat): ActivityGrader<ActivityScriptLike, ActivityGradeResult> | undefined {
  return GRADERS.get(format);
}

/**
 * Detects the format of a step script. `format` field wins (Fase 1 content);
 * otherwise content with `options` is legacy mcq_single and content with
 * `items` is ordering.
 */
export function detectScriptFormat(script: unknown): ActivityFormat {
  if (script === null || typeof script !== 'object') return LEGACY_FORMAT;
  const s = script as { format?: unknown; options?: unknown; items?: unknown; answer?: unknown };
  if (
    typeof s.format === 'string' &&
    ['mcq_single', 'mcq_multi', 'true_false', 'ordering'].includes(s.format)
  ) {
    return s.format as ActivityFormat;
  }
  if (Array.isArray(s.items) && s.items.length > 1) return 'ordering';
  if (typeof s.answer === 'boolean') return 'true_false';
  return LEGACY_FORMAT;
}

// ---- Feedback helpers (single source of defaults) ----

function fbCorrect(script: ActivityScriptLike): string {
  return script.feedback?.correct ?? '¡Correcto!';
}
function fbIncorrect(script: ActivityScriptLike): string {
  return script.feedback?.incorrect ?? 'Incorrecto.';
}
function fbPartial(script: ActivityScriptLike): string {
  return script.feedback?.partial ?? script.feedback?.incorrect ?? 'Casi, seguí intentando.';
}
