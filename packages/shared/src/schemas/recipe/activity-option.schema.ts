import { z } from 'zod';

// ==================== Activity Option ====================

// Transport shape for activity options. `isCorrect` is optional because the
// API strips it from client-facing payloads (it leaked the correct answer);
// authoring paths (StepEditor, AI generator) validate it server-side.
// `id` is optional for legacy content; the API synthesizes `opt-<index>` ids.
export const ActivityOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  isCorrect: z.boolean().optional(),
});

export type ActivityOption = z.infer<typeof ActivityOptionSchema>;
