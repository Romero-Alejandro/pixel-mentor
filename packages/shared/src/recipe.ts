import { z } from 'zod';

// ==================== Static Content Types ====================
export const StepContentSchema = z.object({
  transition: z.string(),
  content: z.string(),
  examples: z.array(z.string()),
  closure: z.string(),
});

export const ActivityOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

export const ActivityContentSchema = z.object({
  instruction: z.string(),
  options: z.array(ActivityOptionSchema).optional(),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
    partial: z.string().optional(),
  }),
});

export const StaticContentSchema = z.object({
  stepType: z.enum(['content', 'activity', 'intro', 'closure']),
  script: StepContentSchema.optional(),
  activity: ActivityContentSchema.optional(),
});

export type StepContent = z.infer<typeof StepContentSchema>;
export type ActivityOption = z.infer<typeof ActivityOptionSchema>;
export type ActivityContent = z.infer<typeof ActivityContentSchema>;
export type StaticContent = z.infer<typeof StaticContentSchema>;

// ==================== Recipe ====================

export const RecipeStepSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  atomId: z.string(),
  order: z.number(),
  condition: z.any().optional(),
  onCondition: z.string().optional(),
});

export const RecipeTagSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const RecipeSchema = z.object({
  id: z.string(),
  canonicalId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  expectedDurationMinutes: z.number().optional(),
  version: z.string(),
  published: z.boolean(),
  moduleId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  steps: z.array(RecipeStepSchema).optional(),
  tags: z.array(RecipeTagSchema).optional(),
});

// ==================== Recipe Responses ====================

export const StartRecipeInputSchema = z.object({
  recipeId: z.string(),
});

export const StartRecipeOutputSchema = z.object({
  sessionId: z.string(),
  voiceText: z.string(),
  pedagogicalState: z.enum([
    'AWAITING_START',
    'ACTIVE_CLASS',
    'RESOLVING_DOUBT',
    'CLARIFYING',
    'QUESTION',
    'EVALUATION',
    'COMPLETED',
    'EXPLANATION',
    'ACTIVITY_WAIT',
    'ACTIVITY_INACTIVITY_WARNING',
    'ACTIVITY_SKIP_OFFER',
    'ACTIVITY_REPEAT',
  ]),
  resumed: z.boolean().optional(),
  needsStart: z.boolean().optional(),
  staticContent: StaticContentSchema.optional(),
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

export const InteractRecipeInputSchema = z.object({
  sessionId: z.string(),
  studentInput: z.string().min(1).max(1000),
});

export const InteractRecipeOutputSchema = z.object({
  voiceText: z.string(),
  pedagogicalState: z.enum([
    'AWAITING_START',
    'ACTIVE_CLASS',
    'RESOLVING_DOUBT',
    'CLARIFYING',
    'QUESTION',
    'EVALUATION',
    'COMPLETED',
    'EXPLANATION',
    'ACTIVITY_WAIT',
    'ACTIVITY_INACTIVITY_WARNING',
    'ACTIVITY_SKIP_OFFER',
    'ACTIVITY_REPEAT',
  ]),
  sessionCompleted: z.boolean().optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().nullish(),
  extraExplanation: z.string().optional(),
  staticContent: StaticContentSchema.optional(),
  // Auto-advance fields for fluid class flow
  autoAdvance: z.boolean().optional(),
  autoAdvanceDelay: z.number().optional(),
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

// ==================== Question Answer ====================
export const QuestionAnswerInputSchema = z.object({
  recipeId: z.string(),
  question: z.string().min(1).max(1000),
});

export const QuestionAnswerOutputSchema = z.object({
  answer: z.string(),
  isOnTopic: z.boolean(),
});

// ==================== Types ====================

export type RecipeStep = z.infer<typeof RecipeStepSchema>;
export type RecipeTag = z.infer<typeof RecipeTagSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type StartRecipeInput = z.infer<typeof StartRecipeInputSchema>;
export type StartRecipeOutput = z.infer<typeof StartRecipeOutputSchema>;
export type InteractRecipeInput = z.infer<typeof InteractRecipeInputSchema>;
export type InteractRecipeOutput = z.infer<typeof InteractRecipeOutputSchema>;
