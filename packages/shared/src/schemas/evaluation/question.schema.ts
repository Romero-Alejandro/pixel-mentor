import { z } from 'zod';

// ==================== Question Answer Input ====================

export const QuestionAnswerInputSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  question: z.string().min(1).max(1000),
});

export type QuestionAnswerInput = z.infer<typeof QuestionAnswerInputSchema>;

// ==================== Question Answer Output ====================

export const QuestionAnswerOutputSchema = z.object({
  answer: z.string(),
  isOnTopic: z.boolean(),
});

export type QuestionAnswerOutput = z.infer<typeof QuestionAnswerOutputSchema>;
