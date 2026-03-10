import { z } from 'zod';

// ==================== Lesson Orchestration ====================
export const StartLessonInputSchema = z.object({
  lessonId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  studentId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type StartLessonInput = z.infer<typeof StartLessonInputSchema>;

export const StartLessonOutputSchema = z.object({
  sessionId: z.string().uuid(),
  voiceText: z.string(),
  pedagogicalState: z.enum(['EXPLANATION', 'QUESTION', 'EVALUATION']),
});
export type StartLessonOutput = z.infer<typeof StartLessonOutputSchema>;

export const InteractLessonInputSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  studentInput: z.string().min(1).max(1000),
});
export type InteractLessonInput = z.infer<typeof InteractLessonInputSchema>;

export const InteractLessonOutputSchema = z.object({
  voiceText: z.string(),
  pedagogicalState: z.enum(['EXPLANATION', 'QUESTION', 'EVALUATION']),
  sessionCompleted: z.boolean().optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().optional(),
  extraExplanation: z.string().optional(),
});
export type InteractLessonOutput = z.infer<typeof InteractLessonOutputSchema>;

// ==================== Lesson Read ====================
export const GetLessonInputSchema = z.object({
  lessonId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetLessonInput = z.infer<typeof GetLessonInputSchema>;

export const ListLessonsInputSchema = z.object({
  activeOnly: z.boolean().optional().default(true),
});
export type ListLessonsInput = z.infer<typeof ListLessonsInputSchema>;

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
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  activeOnly: z.boolean().optional().default(false),
});
export type ListSessionsInput = z.infer<typeof ListSessionsInputSchema>;
