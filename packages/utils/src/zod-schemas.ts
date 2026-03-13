import { z } from 'zod';

export const PEDAGOGICAL_STATE_ENUM = ['EXPLANATION', 'QUESTION', 'EVALUATION'] as const;
export type PedagogicalState = (typeof PEDAGOGICAL_STATE_ENUM)[number];

export const PedagogicalStateSchema = z.enum(PEDAGOGICAL_STATE_ENUM);

export const ConceptSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  example: z.string().max(500).optional(),
});

export const AnalogySchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(500),
  sourceDomain: z.string().min(1).max(100),
  targetDomain: z.string().min(1).max(100),
});

export const CommonErrorSchema = z.object({
  id: z.string().uuid(),
  incorrectConcept: z.string().min(1).max(500),
  correctionExplanation: z.string().min(1).max(1000),
});

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(1000),
  expectedAnswer: z.string().min(1).max(2000),
  feedbackExplanation: z.string().max(1000).optional(),
  multipleChoiceOptions: z.array(z.string()).max(4).optional(),
  order: z.number().int().min(0),
});

export const LessonContentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  concepts: z.array(ConceptSchema).min(1),
  analogies: z.array(AnalogySchema),
  commonErrors: z.array(CommonErrorSchema),
  baseExplanation: z.string().min(1).max(5000),
  questions: z.array(QuestionSchema).min(1),
  active: z.boolean().default(true),
});

export const ExchangeSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(5000),
  pedagogicalState: PedagogicalStateSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const StudentProgressSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  userId: z.string().uuid(),
  currentState: PedagogicalStateSchema,
  currentQuestionIndex: z.number().int().min(0).default(0),
  exchanges: z.array(ExchangeSchema),
  startDate: z.string().datetime(),
  lastActivityDate: z.string().datetime(),
  score: z.number().min(0).max(100).optional(),
  completed: z.boolean().default(false),
});

export const UserInputSchema = z
  .string()
  .min(1, 'El input no puede estar vacío')
  .max(2000, 'El input excede el límite de caracteres');

export const AIResponseSchema = z.object({
  voiceText: z.string().min(1).max(3000),
  pedagogicalState: PedagogicalStateSchema,
  feedback: z.string().max(1000).optional(),
  isCorrect: z.boolean().optional(),
  extraExplanation: z.string().max(2000).optional(),
  chainOfThought: z.string().max(5000).optional(),
});

// Type Inference for domain use
export type Concept = z.infer<typeof ConceptSchema>;
export type Analogy = z.infer<typeof AnalogySchema>;
export type CommonError = z.infer<typeof CommonErrorSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type LessonContent = z.infer<typeof LessonContentSchema>;
export type Exchange = z.infer<typeof ExchangeSchema>;
export type StudentProgress = z.infer<typeof StudentProgressSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
