import { z } from 'zod';

// ==================== Activity Option ====================

export const ActivityOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

export type ActivityOption = z.infer<typeof ActivityOptionSchema>;
