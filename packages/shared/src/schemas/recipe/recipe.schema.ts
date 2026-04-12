import { z } from 'zod';

// ============ Text Objects ============

// Allow both string and { text: string } for backward compatibility
const TextObjectSchema = z.union([z.string(), z.object({ text: z.string() })]).optional();

const RichTextSchema = z
  .union([
    z.string(), // Allow plain string for backward compatibility
    z.object({
      text: z.string().min(1),
    }),
  ])
  .optional();

const TextChunkSchema = z
  .union([
    z.string(), // Allow plain string for backward compatibility
    z.object({
      text: z.string().min(1),
      pauseAfter: z.number().int().min(0).default(0),
    }),
  ])
  .optional();

const TextExampleSchema = z
  .union([
    z.string(), // Allow plain string for backward compatibility
    z.object({
      text: z.string().min(1),
    }),
  ])
  .optional();

// ============ Script Content ============

// For backward compatibility, allow any record
export const ScriptContentSchema = z.record(z.unknown()).optional();

// Keep the strict version for future use
export const ScriptContentSchemaStrict = z
  .object({
    transition: TextObjectSchema,
    content: RichTextSchema,
    chunks: z.array(TextChunkSchema).optional(),
    examples: z.array(TextExampleSchema).optional(),
    closure: TextObjectSchema,
  })
  .optional();

// ============ Activity Content ============

// For backward compatibility, allow any record
export const ActivityOptionSchema = z.record(z.unknown()).nullable().optional();
export const ActivityFeedbackSchema = z.record(z.unknown()).optional();
export const ActivityContentSchema = z.record(z.unknown()).optional();

// ============ Question Content ============

export const QuestionFeedbackSchema = z.record(z.unknown()).optional();
export const QuestionSchema = z.record(z.unknown()).optional();

// ============ Condition ============

export const ConditionSchema = z.record(z.unknown()).nullable().optional();

// ============ Static Content (Union for step type) ============

export const StaticContentSchema = z.object({
  stepType: z.enum(['content', 'activity', 'question', 'intro', 'closure']),
  script: ScriptContentSchema.optional(),
  activity: ActivityContentSchema.optional(),
  question: QuestionSchema.optional(),
});

// ============ Recipe Step ============

export const RecipeStepSchema = z.object({
  id: z.string().uuid(),
  recipeId: z.string().uuid(),
  atomId: z.string().uuid().nullable().optional(),
  order: z.number().int().nonnegative(),
  condition: ConditionSchema,
  onCondition: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  conceptId: z.string().uuid().nullable().optional(),
  activityId: z.string().uuid().nullable().optional(),
  stepType: z.enum(['content', 'activity', 'question', 'intro', 'closure']).nullable().optional(),
  script: ScriptContentSchema.nullable().optional(),
  activity: ActivityContentSchema.nullable().optional(),
  question: QuestionSchema.nullable().optional(),
});

export const RecipeStepInputSchema = RecipeStepSchema.omit({
  id: true,
  recipeId: true,
  createdAt: true,
});

// ============ Recipe ============

export const CreateRecipeInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  expectedDurationMinutes: z.number().int().min(1).optional(),
  moduleId: z.string().uuid().nullable().optional(),
  published: z.boolean().optional().default(false),
});

export const UpdateRecipeInputSchema = CreateRecipeInputSchema.partial();

export const ReorderStepsInputSchema = z.object({
  stepIds: z.array(z.string().uuid()),
});

export const GetRecipeInputSchema = z.object({
  recipeId: z.string().uuid(),
});

export const ListRecipesInputSchema = z.object({
  published: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const RecipeTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export const RecipeSchema = z.object({
  id: z.string().uuid(),
  canonicalId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  expectedDurationMinutes: z.number().int().nullable().optional(),
  version: z.string(),
  published: z.boolean(),
  moduleId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  steps: z.array(RecipeStepSchema).optional(),
  tags: z.array(RecipeTagSchema).optional(),
});

// ============ Type Inferences ============

export type TextObject = z.infer<typeof TextObjectSchema>;
export type RichText = z.infer<typeof RichTextSchema>;
export type TextChunk = z.infer<typeof TextChunkSchema>;
export type TextExample = z.infer<typeof TextExampleSchema>;
export type ScriptContent = z.infer<typeof ScriptContentSchema>;
export type ActivityOption = z.infer<typeof ActivityOptionSchema>;
export type ActivityFeedback = z.infer<typeof ActivityFeedbackSchema>;
export type ActivityContent = z.infer<typeof ActivityContentSchema>;
export type QuestionFeedback = z.infer<typeof QuestionFeedbackSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type StaticContent = z.infer<typeof StaticContentSchema>;
export type RecipeStep = z.infer<typeof RecipeStepSchema>;
export type RecipeStepInput = z.infer<typeof RecipeStepInputSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;
export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInputSchema>;
export type ReorderStepsInput = z.infer<typeof ReorderStepsInputSchema>;
export type GetRecipeInput = z.infer<typeof GetRecipeInputSchema>;
export type ListRecipesInput = z.infer<typeof ListRecipesInputSchema>;
export type RecipeTag = z.infer<typeof RecipeTagSchema>;
