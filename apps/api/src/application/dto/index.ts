import { z } from 'zod';

// ==================== Static Content Types ====================
export const StepContentSchema = z.object({
  transition: z.string(),
  content: z.string(),
  examples: z.array(z.string()),
  closure: z.string(),
});
export type StepContent = z.infer<typeof StepContentSchema>;

export const ActivityOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});
export type ActivityOption = z.infer<typeof ActivityOptionSchema>;

export const ActivityContentSchema = z.object({
  instruction: z.string(),
  options: z.array(ActivityOptionSchema).optional(),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
    partial: z.string().optional(),
  }),
});
export type ActivityContent = z.infer<typeof ActivityContentSchema>;

export const StaticContentSchema = z.object({
  stepType: z.enum(['content', 'activity', 'intro', 'closure']),
  script: StepContentSchema.optional(),
  activity: ActivityContentSchema.optional(),
});
export type StaticContent = z.infer<typeof StaticContentSchema>;

// ==================== Recipe Orchestration ====================
export const StartRecipeInputSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type StartRecipeInput = z.infer<typeof StartRecipeInputSchema>;

export const StartRecipeOutputSchema = z.object({
  sessionId: z.string().uuid(),
  voiceText: z.string(),
  pedagogicalState: z.enum([
    'AWAITING_START',
    'ACTIVE_CLASS',
    'RESOLVING_DOUBT',
    'CLARIFYING',
    'EXPLANATION',
    'ACTIVITY_WAIT',
    'ACTIVITY_INACTIVITY_WARNING',
    'ACTIVITY_SKIP_OFFER',
    'QUESTION',
    'EVALUATION',
    'COMPLETED',
  ]),
  resumed: z.boolean().optional(),
  needsStart: z.boolean().optional(),
  staticContent: StaticContentSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type StartRecipeOutput = z.infer<typeof StartRecipeOutputSchema>;

export const InteractRecipeInputSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  studentInput: z.string().min(1).max(1000),
});
export type InteractRecipeInput = z.infer<typeof InteractRecipeInputSchema>;

export const InteractRecipeOutputSchema = z.object({
  voiceText: z.string(),
  pedagogicalState: z.enum([
    'AWAITING_START',
    'ACTIVE_CLASS',
    'RESOLVING_DOUBT',
    'CLARIFYING',
    'EXPLANATION',
    'ACTIVITY_WAIT',
    'ACTIVITY_INACTIVITY_WARNING',
    'ACTIVITY_SKIP_OFFER',
    'QUESTION',
    'EVALUATION',
    'COMPLETED',
  ]),
  sessionCompleted: z.boolean().optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().nullish(),
  extraExplanation: z.string().optional(),
  staticContent: StaticContentSchema.optional(),
  // Auto-advance fields for fluid class flow
  autoAdvance: z.boolean().optional(),
  autoAdvanceDelay: z.number().optional(),
});
export type InteractRecipeOutput = z.infer<typeof InteractRecipeOutputSchema>;

// ==================== Recipe Read ====================
export const GetRecipeInputSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetRecipeInput = z.infer<typeof GetRecipeInputSchema>;

export const ListRecipesInputSchema = z.object({
  activeOnly: z.boolean().optional().default(true),
});
export type ListRecipesInput = z.infer<typeof ListRecipesInputSchema>;

// ==================== Question Answering ====================
export const QuestionAnswerInputSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  question: z.string().min(1).max(1000),
});
export type QuestionAnswerInput = z.infer<typeof QuestionAnswerInputSchema>;

export const QuestionAnswerOutputSchema = z.object({
  answer: z.string(),
  isOnTopic: z.boolean(),
});
export type QuestionAnswerOutput = z.infer<typeof QuestionAnswerOutputSchema>;

// ==================== Session Read ====================
export const GetSessionInputSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetSessionInput = z.infer<typeof GetSessionInputSchema>;

export const ListSessionsInputSchema = z.object({
  studentId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .optional(),
  activeOnly: z.boolean().optional().default(false),
});
export type ListSessionsInput = z.infer<typeof ListSessionsInputSchema>;
