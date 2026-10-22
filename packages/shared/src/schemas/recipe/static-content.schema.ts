import { z } from 'zod';

import { StepContentSchema } from './step-content.schema.js';
import { ActivityContentSchema } from './activity-content.schema.js';
import { ActivityFormatSchema } from '../../activities/formats.js';

// ==================== Static Content ====================

export const StaticContentSchema = z.object({
  stepType: z.enum(['content', 'activity', 'question', 'intro', 'closure']),
  script: StepContentSchema.optional(),
  activity: ActivityContentSchema.optional(),
  /** Activity plugin format (Fase 1). Absent = legacy mcq_single. */
  activityFormat: ActivityFormatSchema.optional(),
});

export type StaticContent = z.infer<typeof StaticContentSchema>;
