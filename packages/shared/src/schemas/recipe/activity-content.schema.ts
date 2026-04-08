import { z } from 'zod';

import { ActivityOptionSchema } from './activity-option.schema.js';

// ==================== Activity Content ====================

export const ActivityContentSchema = z.object({
  instruction: z.string(),
  options: z.array(ActivityOptionSchema).optional(),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
    partial: z.string().optional(),
  }),
});

export type ActivityContent = z.infer<typeof ActivityContentSchema>;
