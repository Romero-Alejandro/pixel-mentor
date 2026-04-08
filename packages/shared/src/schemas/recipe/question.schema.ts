import { z } from 'zod';

// ==================== Question Answer Schema (for question type steps) ====================

const QuestionAnswerSchema = z.object({
  question: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  expectedAnswer: z.string().min(1),
  feedback: z.object({
    correct: z.string().min(1),
    incorrect: z.string().min(1),
  }),
});

// ==================== Question Schema ====================

export const QuestionSchema = z.object({
  question: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  answer: QuestionAnswerSchema,
});

export type Question = z.infer<typeof QuestionSchema>;
