import { z } from 'zod';

// ==================== Step Transition ====================

const StepTransitionSchema = z.object({
  text: z.string().min(1),
});

// ==================== Content Chunk ====================

const ContentChunkSchema = z.object({
  text: z.string().min(1),
  pauseAfter: z.number().int().min(0),
});

// ==================== Step Content Schema 2 ====================

const StepContentSchema2 = z.object({
  text: z.string().min(1),
  chunks: z.array(ContentChunkSchema).min(1),
});

// ==================== Step Example ====================

const StepExampleSchema = z.object({
  text: z.string().min(1),
  visual: z
    .object({
      type: z.enum(['image', 'animation', 'equation']),
      src: z.string().url().optional(),
    })
    .optional(),
});

// ==================== Step Comprehension Check ====================

const StepComprehensionCheckSchema = z.object({
  question: z.string().min(1),
  expectedAnswer: z.string().min(1),
  feedback: z.object({
    correct: z.string().min(1),
    incorrect: z.string().min(1),
  }),
});

// ==================== Step Closure ====================

const StepClosureSchema = z.object({
  text: z.string().min(1),
});

// ==================== Step Script Schema Content ====================

export const StepScriptSchemaContent = z.object({
  transition: StepTransitionSchema,
  content: StepContentSchema2,
  examples: z.array(StepExampleSchema).min(1),
  comprehensionCheck: StepComprehensionCheckSchema.optional(),
  closure: StepClosureSchema,
});

// ==================== Step Script Schema Activity ====================

export const StepScriptSchemaActivity = z.object({
  kind: z.literal('activity'),
  transition: z.union([z.string(), z.object({ text: z.string() })]).optional(),
  instruction: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  options: z
    .array(
      z.object({
        text: z.string(),
        isCorrect: z.boolean(),
      }),
    )
    .optional(),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
    partial: z.string().optional(),
  }),
  closure: z.string().optional(),
});

// ==================== Step Script Schema Question ====================

export const StepScriptSchemaQuestion = z.object({
  kind: z.literal('question'),
  transition: z.union([z.string(), z.object({ text: z.string() })]).optional(),
  question: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  expectedAnswer: z.string().optional(),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
  }),
  hint: z.string().optional(),
});

// ==================== Activity Or Question Schema ====================

const ActivityOrQuestionSchema = z.discriminatedUnion('kind', [
  StepScriptSchemaActivity,
  StepScriptSchemaQuestion,
]);

// ==================== Step Script Schema (Union) ====================

export const StepScriptSchema = z.union([StepScriptSchemaContent, ActivityOrQuestionSchema]);

export type StepScript = z.infer<typeof StepScriptSchema>;
