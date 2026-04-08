import { z } from 'zod';

import {
  PedagogicalStateSchema,
  StaticContentSchema,
  LessonProgressSchema,
} from './start-recipe.schema.js';

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
    autoAdvance: z.boolean().optional(),
  }),
]);

export type InteractionChunk = z.infer<typeof InteractionChunkSchema>;
