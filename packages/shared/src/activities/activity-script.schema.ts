import { z } from 'zod';

import { ACTIVITY_FORMATS } from './formats.js';

// ==================== Activity Script Schemas (Fase 1) ====================
//
// Authoring/validation shapes for the script JSON embedded in each step.
// `format` is the discriminant; every schema extends the common envelope
// (transition/instruction/feedback) so the mapper can treat them uniformly.

const FeedbackSchema = z.object({
  correct: z.string().min(1).default('¡Correcto!'),
  incorrect: z.string().min(1).default('Incorrecto.'),
  partial: z.string().optional(),
});

const ActivityEnvelope = {
  kind: z.literal('activity').default('activity'),
  format: z.enum(ACTIVITY_FORMATS),
  transition: z.string().optional(),
  closure: z.string().optional(),
};

export const McqSingleScriptSchema = z.object({
  ...ActivityEnvelope,
  format: z.literal('mcq_single'),
  instruction: z.string().min(1),
  options: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        text: z.string().min(1),
        isCorrect: z.boolean(),
      }),
    )
    .min(2),
  feedback: FeedbackSchema.optional(),
});

export const McqMultiScriptSchema = z.object({
  ...ActivityEnvelope,
  format: z.literal('mcq_multi'),
  instruction: z.string().min(1),
  options: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        text: z.string().min(1),
        isCorrect: z.boolean(),
      }),
    )
    .min(2),
  feedback: FeedbackSchema.optional(),
});

export const TrueFalseScriptSchema = z.object({
  ...ActivityEnvelope,
  format: z.literal('true_false'),
  instruction: z.string().min(1),
  /** The asserted truth value the student must confirm or refute. */
  answer: z.boolean(),
  feedback: FeedbackSchema.optional(),
});

export const OrderingScriptSchema = z.object({
  ...ActivityEnvelope,
  format: z.literal('ordering'),
  instruction: z.string().min(1),
  /** Items in the CORRECT order; the UI shuffles them for the student. */
  items: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        text: z.string().min(1),
      }),
    )
    .min(2),
  feedback: FeedbackSchema.optional(),
});

export const TypedActivityScriptSchema = z.discriminatedUnion('format', [
  McqSingleScriptSchema,
  McqMultiScriptSchema,
  TrueFalseScriptSchema,
  OrderingScriptSchema,
]);

export type McqSingleScriptInput = z.infer<typeof McqSingleScriptSchema>;
export type McqMultiScriptInput = z.infer<typeof McqMultiScriptSchema>;
export type TrueFalseScriptInput = z.infer<typeof TrueFalseScriptSchema>;
export type OrderingScriptInput = z.infer<typeof OrderingScriptSchema>;
export type TypedActivityScript = z.infer<typeof TypedActivityScriptSchema>;

/**
 * Assigns stable derived ids (`<field>-<index>`) to any option/item missing
 * one. Authoring tools may omit ids; grading and reveal need them stable.
 */
export function withDerivedIds(script: TypedActivityScript): TypedActivityScript {
  if (script.format === 'true_false') return script;
  if (script.format === 'ordering') {
    return {
      ...script,
      items: script.items.map((it, i) => ({ ...it, id: it.id ?? `item-${i}` })),
    };
  }
  return {
    ...script,
    options: script.options.map((o, i) => ({ ...o, id: o.id ?? `opt-${i}` })),
  };
}
