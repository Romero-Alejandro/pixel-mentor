/**
 * Generated Recipe Schema
 *
 * Zod schemas for AI-generated recipe steps shared between backend and frontend.
 */

import { z } from 'zod';

// ==================== Generated Step ====================

export const GeneratedStepScriptSchema = z
  .object({
    // Content fields
    transition: z.union([z.string(), z.object({ text: z.string() })]).optional(),
    content: z
      .union([
        z.string(),
        z.object({
          text: z.string(),
          chunks: z
            .array(
              z.object({
                text: z.string(),
                pauseAfter: z.number().optional(),
              }),
            )
            .optional(),
        }),
      ])
      .optional(),
    examples: z.array(z.union([z.string(), z.object({ text: z.string() })])).optional(),
    closure: z.union([z.string(), z.object({ text: z.string() })]).optional(),

    // Activity fields
    instruction: z.union([z.string(), z.object({ text: z.string() })]).optional(),
    options: z
      .array(
        z.object({
          text: z.string(),
          isCorrect: z.boolean(),
        }),
      )
      .optional(),
    feedback: z
      .object({
        correct: z.string().optional(),
        incorrect: z.string().optional(),
      })
      .optional(),

    // Question fields
    question: z.union([z.string(), z.object({ text: z.string() })]).optional(),
    expectedAnswer: z.string().optional(),
    hint: z.union([z.string(), z.object({ text: z.string() })]).optional(),
  })
  .optional();

export const GeneratedStepSchema = z.object({
  order: z.number().int().positive(),
  stepType: z.enum(['intro', 'content', 'activity', 'question', 'closure']),
  title: z.string().min(1),
  script: GeneratedStepScriptSchema,
});

export type GeneratedStep = z.infer<typeof GeneratedStepSchema>;
export type GeneratedStepScript = z.infer<typeof GeneratedStepScriptSchema>;

// ==================== Generated Recipe Draft ====================

export const GeneratedRecipeDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  expectedDurationMinutes: z.number().int().positive(),
  steps: z.array(GeneratedStepSchema),
  qualityValidation: z
    .object({
      passed: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
    })
    .optional(),
});

export type GeneratedRecipeDraft = z.infer<typeof GeneratedRecipeDraftSchema>;
