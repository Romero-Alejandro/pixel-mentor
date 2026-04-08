import { z } from 'zod';

import { StaticContentSchema } from '../recipe/static-content.schema.js';

// Re-export StaticContentSchema so it can be used by other modules
export { StaticContentSchema } from '../recipe/static-content.schema.js';

// ==================== Start Recipe Input ====================

export const StartRecipeInputSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});

export type StartRecipeInput = z.infer<typeof StartRecipeInputSchema>;

// ==================== Start Recipe Output ====================

export const PedagogicalStateSchema = z.enum([
  'AWAITING_START',
  'ACTIVE_CLASS',
  'RESOLVING_DOUBT',
  'CLARIFYING',
  'EXPLANATION',
  'ACTIVITY_WAIT',
  'ACTIVITY_INACTIVITY_WARNING',
  'ACTIVITY_SKIP_OFFER',
  'ACTIVITY_REPEAT',
  'QUESTION',
  'EVALUATION',
  'COMPLETED',
]);

export type PedagogicalState = z.infer<typeof PedagogicalStateSchema>;

export const LessonProgressSchema = z.object({
  currentStep: z.number(),
  totalSteps: z.number(),
});

export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const ContentStepSchema = z.object({
  stepIndex: z.number(),
  stepType: z.string(),
  staticContent: z.any(),
});

export type ContentStep = z.infer<typeof ContentStepSchema>;

export const StartRecipeOutputSchema = z.object({
  sessionId: z.string().uuid(),
  voiceText: z.string(),
  pedagogicalState: PedagogicalStateSchema,
  resumed: z.boolean().optional(),
  needsStart: z.boolean().optional(),
  isRepeat: z.boolean().optional(),
  staticContent: StaticContentSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  autoAdvance: z.boolean().optional(),
  lessonProgress: LessonProgressSchema.optional(),
  contentSteps: z.array(ContentStepSchema).optional(),
  meta: z
    .object({
      config: z
        .object({
          tutorName: z.string(),
          maxQuestionsPerSession: z.number(),
          questionCooldownSeconds: z.number(),
          activityTimeoutSeconds: z.number(),
          encouragementAfterInactivitySeconds: z.number(),
          skipAfterFailedAttempts: z.number(),
          skipAfterInactivitySeconds: z.number(),
          enableActivitySkip: z.boolean(),
          tone: z.enum(['friendly', 'formal']),
          greetings: z.object({
            intro: z.string(),
            readyPrompt: z.string(),
            nextConceptTransition: z.string(),
            completionMessage: z.string(),
          }),
          encouragementPhrases: z.array(z.string()),
          jokes: z.array(z.string()),
        })
        .optional(),
      studentName: z.string().optional(),
    })
    .optional(),
});

export type StartRecipeOutput = z.infer<typeof StartRecipeOutputSchema>;
