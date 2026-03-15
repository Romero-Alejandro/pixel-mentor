import { z } from 'zod';

import { SessionCheckpointSchema } from './pedagogical';

// ==================== Session Status ====================

export const SessionStatusSchema = z.enum([
  'IDLE',
  'ACTIVE',
  'PAUSED_FOR_QUESTION',
  'AWAITING_CONFIRMATION',
  'PAUSED_IDLE',
  'COMPLETED',
  'ESCALATED',
]);

// ==================== Session ====================

export const SessionSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  recipeId: z.string(),
  status: SessionStatusSchema,
  stateCheckpoint: SessionCheckpointSchema.nullable().optional(),
  startedAt: z.string().optional(),
  lastActivityAt: z.string().optional(),
  completedAt: z.string().nullish(),
  escalatedAt: z.string().nullish(),
  version: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  safetyFlag: z.string().nullish(),
  outOfScope: z.boolean().nullish(),
  failedAttempts: z.number().nullish(),
});

// ==================== Session Responses ====================

export const GetSessionInputSchema = z.object({
  sessionId: z.string(),
});

export const ListSessionsInputSchema = z.object({
  studentId: z.string().optional(),
  activeOnly: z.boolean().optional().default(false),
});

// ==================== Types ====================

export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type GetSessionInput = z.infer<typeof GetSessionInputSchema>;
export type ListSessionsInput = z.infer<typeof ListSessionsInputSchema>;
