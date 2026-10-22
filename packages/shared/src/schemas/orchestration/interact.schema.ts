import { z } from 'zod';

import { StaticContentSchema } from '../recipe/static-content.schema.js';

import { PedagogicalStateSchema, LessonProgressSchema } from './start-recipe.schema.js';
import { ActivityResponseSchema } from '../../activities/formats.js';

// ==================== Interact Recipe Input ====================

export const InteractRecipeInputSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  studentInput: z.string().min(1).max(1000),
  /** Selected option id for MCQ activities (authoritative grading). */
  optionId: z.string().min(1).max(100).optional(),
  /** Structured response payload for Fase 1 formats (mcq_multi, true_false, ordering). */
  activityResponse: ActivityResponseSchema.optional(),
  /** Unique interaction ID for request deduplication on retry */
  interactionId: z.string().uuid().optional(),
});

export type InteractRecipeInput = z.infer<typeof InteractRecipeInputSchema>;

// ==================== Accuracy Tier ====================

export const AccuracyTierSchema = z.enum(['perfect', 'high', 'medium', 'low']);

// ==================== Accuracy ====================

export const AccuracySchema = z.object({
  correctFirstAttempts: z.number(),
  totalActivities: z.number(),
  skippedActivities: z.number(),
  accuracyPercent: z.number(),
  tier: AccuracyTierSchema,
  /** Fase 2: 0..100 average partial score of last attempts (undefined for binary formats). */
  partialCreditPercent: z.number().optional(),
  /** Fase 2: correct first attempts WITHOUT consuming a hint (hint-free bonus). */
  correctFirstAttemptsWithoutHints: z.number().optional(),
});

export type Accuracy = z.infer<typeof AccuracySchema>;

// ==================== Interact Recipe Output ====================

export const InteractRecipeOutputSchema = z.object({
  voiceText: z.string(),
  pedagogicalState: PedagogicalStateSchema,
  sessionCompleted: z.boolean().optional(),
  lessonProgress: LessonProgressSchema.optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().nullish(),
  /** Revealed AFTER grading so clients can show the correct option without ever receiving `isCorrect` up front. */
  correctOptionId: z.string().optional(),
  /** Format-generic reveal for Fase 1 formats. Only present AFTER grading. */
  correctAnswer: z.unknown().optional(),
  /** Activity format of the graded step, when applicable. */
  activityFormat: z.string().optional(),
  /** Partial score 0..1 for multi-answer formats. */
  score: z.number().min(0).max(1).optional(),
  /** ms the client should wait before auto-advancing after this feedback (adaptivity pacing). */
  autoAdvanceDelayMs: z.number().int().min(0).optional(),
  extraExplanation: z.string().optional(),
  staticContent: StaticContentSchema.optional(),
  // Auto-advance fields for fluid class flow
  autoAdvance: z.boolean().optional(),
  autoAdvanceDelay: z.number().optional(),
  // Gamification data for completed lessons
  xpEarned: z.number().optional(),
  accuracy: AccuracySchema.optional(),
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

export type InteractRecipeOutput = z.infer<typeof InteractRecipeOutputSchema>;
