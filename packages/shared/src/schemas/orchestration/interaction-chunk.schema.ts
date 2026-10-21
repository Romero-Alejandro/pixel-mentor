import { z } from 'zod';

import {
  PedagogicalStateSchema,
  StaticContentSchema,
  LessonProgressSchema,
} from './start-recipe.schema.js';
import { AccuracySchema } from './interact.schema.js';

// ==================== Interaction Chunk ====================

export const InteractionChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), text: z.string() }),
  z.object({
    type: z.literal('end'),
    reason: z.enum(['completed']),
    pedagogicalState: PedagogicalStateSchema,
    sessionCompleted: z.boolean(),
    staticContent: StaticContentSchema.optional(),
    lessonProgress: LessonProgressSchema,
    feedback: z.string().optional(),
    isCorrect: z.boolean().optional(),
    /** Revealed after grading: lets clients show the correct option without receiving it up front. */
    correctOptionId: z.string().optional(),
    /** Format-generic reveal for Fase 1 formats (ids, booleans, sequences). Only present AFTER grading. */
    correctAnswer: z.unknown().optional(),
    /** Activity format of the graded step, when applicable. */
    activityFormat: z.string().optional(),
    /** Partial score 0..1 for multi-answer formats. */
    score: z.number().min(0).max(1).optional(),
    /** ms the client should wait before auto-advancing after this feedback (adaptivity pacing). */
    autoAdvanceDelayMs: z.number().int().min(0).optional(),
    autoAdvance: z.boolean().optional(),
    xpEarned: z.number().optional(),
    accuracy: AccuracySchema.optional(),
  }),
]);

export type InteractionChunk = z.infer<typeof InteractionChunkSchema>;
