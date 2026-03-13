import { z } from 'zod';

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
    'ACTIVE_CLASS',
    'RESOLVING_DOUBT',
    'CLARIFYING',
    'QUESTION',
    'EVALUATION',
    'COMPLETED',
    'EXPLANATION',
  ]),
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
    'ACTIVE_CLASS',
    'RESOLVING_DOUBT',
    'CLARIFYING',
    'QUESTION',
    'EVALUATION',
    'COMPLETED',
    'EXPLANATION',
  ]),
  sessionCompleted: z.boolean().optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().nullish(),
  extraExplanation: z.string().optional(),
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
