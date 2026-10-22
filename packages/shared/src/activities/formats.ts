// ==================== Activity Format Registry (Fase 1) ====================
//
// Formats are data, not `if`s: every activity script carries a `format` and
// the system delegates to a plugin (schema + grader + renderer) keyed by it.
// Adding a new activity type = adding files, never touching the core.

import { z } from 'zod';

// ==================== Format catalog ====================

export const ACTIVITY_FORMATS = [
  'mcq_single',
  'mcq_multi',
  'true_false',
  'ordering',
] as const;

export type ActivityFormat = (typeof ACTIVITY_FORMATS)[number];

export const ActivityFormatSchema = z.enum(ACTIVITY_FORMATS);

export const LEGACY_FORMAT: ActivityFormat = 'mcq_single';

// ==================== Structured student responses ====================
//
// `mcq_single` keeps the Fase 0 flat shape (`optionId`) so legacy clients keep
// working. Newer formats send a structured payload.

/** mcq_multi: student toggles a set of options and confirms. */
export interface MultiSelectResponse {
  format: 'mcq_multi';
  optionIds: string[];
}

/** true_false: single statement with a boolean answer. */
export interface TrueFalseResponse {
  format: 'true_false';
  value: boolean;
}

/** ordering: student submits the items in the order they believe is right. */
export interface OrderingResponse {
  format: 'ordering';
  itemIds: string[];
}

export type StructuredActivityResponse = MultiSelectResponse | TrueFalseResponse | OrderingResponse;

/** Wire shape of the `activityResponse` field on interact inputs. */
export const ActivityResponseSchema = z.discriminatedUnion('format', [
  z.object({ format: z.literal('mcq_multi'), optionIds: z.array(z.string().min(1)).min(1).max(20) }),
  z.object({ format: z.literal('true_false'), value: z.boolean() }),
  z.object({ format: z.literal('ordering'), itemIds: z.array(z.string().min(1)).min(1).max(20) }),
]);

export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;

// ==================== Plugin descriptor ====================
//
// Graders are pure functions defined in grading.ts; this descriptor is what a
// plugin contributes to the registry. `renderer` lives on the web side, where
// components are registered by format.

export interface ActivityResponseContext {
  /** Free-text input (voice or legacy fallback). Always present on interact. */
  studentInput: string;
  /** Flat option id (mcq_single path, Fase 0 clients). */
  optionId?: string;
  /** Structured payload (Fase 1 formats). */
  structured?: ActivityResponse;
}

export interface ActivityGrader<
  TScript extends ActivityScriptLike = ActivityScriptLike,
  TResult extends ActivityGradeResult = ActivityGradeResult,
> {
  readonly format: ActivityFormat;
  /** Narrowing guard: does this script belong to this plugin? */
  readonly matchesScript: (script: unknown) => script is TScript;
  /** Pure, deterministic grading. Must not throw for malformed responses. */
  readonly grade: (script: TScript, context: ActivityResponseContext) => TResult;
}

// Structural script type so shared/ stays decoupled from API-layer entities.
export interface ActivityScriptLike {
  instruction?: unknown;
  options?: readonly unknown[];
  items?: readonly unknown[];
  feedback?: { correct?: string; incorrect?: string; partial?: string };
}

export interface ActivityGradeResult {
  isCorrect: boolean;
  /** Partial score 0..1 for multi-answer formats (undefined = fully binary). */
  score?: number;
  feedback: string;
  /** ids/texts revealed AFTER grading; never sent before the student answers. */
  correctAnswer?: unknown;
}

export function formatSupportsStructuredResponses(format: ActivityFormat): boolean {
  return format === 'mcq_multi' || format === 'true_false' || format === 'ordering';
}
