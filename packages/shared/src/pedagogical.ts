import { z } from 'zod';

// ==================== Pedagogical State ====================

export const PedagogicalStateSchema = z.enum([
  'AWAITING_START',
  'ACTIVE_CLASS',
  'RESOLVING_DOUBT',
  'CLARIFYING',
  'EXPLANATION',
  'QUESTION',
  'EVALUATION',
  'COMPLETED',
  'ACTIVITY_WAIT',
  'ACTIVITY_INACTIVITY_WARNING',
  'ACTIVITY_SKIP_OFFER',
  'ACTIVITY_REPEAT',
]);

export type PedagogicalState = z.infer<typeof PedagogicalStateSchema>;

// ==================== State Checkpoint ====================

export const SessionCheckpointSchema = z.object({
  currentState: PedagogicalStateSchema,
  currentStepIndex: z.number(),
  savedStepIndex: z.number().nullish(),
  doubtContext: z
    .object({
      question: z.string(),
      stepIndex: z.number(),
    })
    .nullish(),
  questionCount: z.number().optional(),
  lastQuestionTime: z.string().nullish(),
  skippedActivities: z.array(z.string()).optional(),
  failedAttempts: z.number().optional(),
  totalWrongAnswers: z.number().optional(),
});

export type SessionCheckpoint = z.infer<typeof SessionCheckpointSchema>;
