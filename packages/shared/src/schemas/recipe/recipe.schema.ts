import { z } from 'zod';

import { StepScriptSchema } from './step-script.schema.js';
import { ActivityContentSchema } from './activity-content.schema.js';
import { QuestionSchema } from './question.schema.js';

// ==================== Recipe Step Input ====================

export const RecipeStepInputSchema = z
  .object({
    atomId: z
      .string()
      .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
      .optional(),
    order: z.number().int().min(0).optional(),
    conceptId: z
      .string()
      .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
      .optional(),
    activityId: z
      .string()
      .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
      .optional(),
    stepType: z.enum(['content', 'activity', 'question', 'intro', 'closure']).default('content'),
    script: StepScriptSchema.optional(),
    activity: ActivityContentSchema.optional(),
    question: QuestionSchema.optional(),
  })
  .refine(
    (data) => {
      // Helper to check if instruction/question is valid (string or object with text)
      const hasValidInstruction = (instruction: unknown): boolean => {
        if (typeof instruction === 'string') return instruction.length > 0;
        if (typeof instruction === 'object' && instruction !== null) {
          const obj = instruction as { text?: string };
          return typeof obj.text === 'string' && obj.text.length > 0;
        }
        return false;
      };

      // If stepType is 'content', must have script
      if (data.stepType === 'content' && !data.script) {
        return false;
      }
      // If stepType is 'activity', must have activity OR script with kind='activity'
      if (data.stepType === 'activity') {
        const hasActivity = data.activity && hasValidInstruction(data.activity.instruction);
        const hasScriptActivity =
          data.script &&
          typeof data.script === 'object' &&
          (data.script as any).kind === 'activity' &&
          hasValidInstruction((data.script as any).instruction);
        if (!hasActivity && !hasScriptActivity) {
          return false;
        }
      }
      // If stepType is 'question', must have question OR script with kind='question'
      if (data.stepType === 'question') {
        // Check question.content for string or object format
        const hasQuestionContent = (q: unknown): boolean => {
          if (typeof q === 'string') return q.length > 0;
          if (typeof q === 'object' && q !== null) {
            const obj = q as { text?: string };
            return typeof obj.text === 'string' && obj.text.length > 0;
          }
          return false;
        };
        const hasQuestion = data.question && hasQuestionContent(data.question.question);
        const hasScriptQuestion =
          data.script &&
          typeof data.script === 'object' &&
          (data.script as any).kind === 'question' &&
          hasQuestionContent((data.script as any).question);
        if (!hasQuestion && !hasScriptQuestion) {
          return false;
        }
      }
      // If stepType is 'intro' or 'closure', must have script
      if ((data.stepType === 'intro' || data.stepType === 'closure') && !data.script) {
        return false;
      }
      return true;
    },
    { message: 'Invalid step content for the specified stepType' },
  );

export type RecipeStepInput = z.infer<typeof RecipeStepInputSchema>;

// ==================== Recipe Step Output ====================

export const RecipeStepOutputSchema = z.object({
  id: z.string().uuid(),
  recipeId: z.string().uuid(),
  atomId: z.string().uuid().nullable(),
  order: z.number().int(),
  condition: z.unknown().nullable(),
  onCondition: z.string().nullable(),
  createdAt: z.string().datetime(),
  conceptId: z.string().uuid().nullable(),
  activityId: z.string().uuid().nullable(),
  script: StepScriptSchema.nullable(),
  stepType: z.string().nullable(),
});

export type RecipeStepOutput = z.infer<typeof RecipeStepOutputSchema>;

// ==================== Recipe Output ====================

export const RecipeOutputSchema = z.object({
  id: z.string().uuid(),
  canonicalId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  expectedDurationMinutes: z.number().int().nullable(),
  version: z.string(),
  published: z.boolean(),
  moduleId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  steps: z.array(RecipeStepOutputSchema),
});

export type RecipeOutput = z.infer<typeof RecipeOutputSchema>;

// ==================== Create Recipe Input ====================

export const CreateRecipeInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  expectedDurationMinutes: z.number().int().min(1).max(480).optional(),
  moduleId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .optional(),
  published: z.boolean().optional().default(false),
  steps: z.array(RecipeStepInputSchema).optional(),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;

// ==================== Update Recipe Input ====================

export const UpdateRecipeInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  expectedDurationMinutes: z.number().int().min(1).max(480).optional(),
  moduleId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .optional(),
  published: z.boolean().optional(),
});

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInputSchema>;

// ==================== Reorder Steps Input ====================

export const ReorderStepsInputSchema = z.object({
  stepIds: z.array(z.string()).min(1),
});

export type ReorderStepsInput = z.infer<typeof ReorderStepsInputSchema>;

// ==================== Get Recipe Input ====================

export const GetRecipeInputSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});

export type GetRecipeInput = z.infer<typeof GetRecipeInputSchema>;

// ==================== List Recipes Input ====================

export const ListRecipesInputSchema = z.object({
  activeOnly: z.boolean().optional().default(true),
});

export type ListRecipesInput = z.infer<typeof ListRecipesInputSchema>;
