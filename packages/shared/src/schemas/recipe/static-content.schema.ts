import { z } from 'zod';

import { StepContentSchema } from './step-content.schema.js';
import { ActivityContentSchema } from './activity-content.schema.js';

// ==================== Static Content ====================

export const StaticContentSchema = z.object({
  stepType: z.enum(['content', 'activity', 'intro', 'closure']),
  script: StepContentSchema.optional(),
  activity: ActivityContentSchema.optional(),
});

export type StaticContent = z.infer<typeof StaticContentSchema>;
