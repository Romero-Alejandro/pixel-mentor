import { z } from 'zod';

// ==================== Step Content ====================

export const StepContentSchema = z.object({
  transition: z.string(),
  content: z.string(),
  examples: z.array(z.string()),
  closure: z.string(),
});

export type StepContent = z.infer<typeof StepContentSchema>;
