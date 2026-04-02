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
  isRepeat: z.boolean().optional(),
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
  lessonProgress: z.object({ currentStep: z.number(), totalSteps: z.number() }).optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().nullish(),
  extraExplanation: z.string().optional(),
  staticContent: StaticContentSchema.optional(),
  // Auto-advance fields for fluid class flow
  autoAdvance: z.boolean().optional(),
  autoAdvanceDelay: z.number().optional(),
  // Gamification data for completed lessons
  xpEarned: z.number().optional(),
  accuracy: z
    .object({
      correctFirstAttempts: z.number(),
      totalActivities: z.number(),
      skippedActivities: z.number(),
      accuracyPercent: z.number(),
      tier: z.enum(['perfect', 'high', 'medium', 'low']),
    })
    .optional(),
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

// ==================== Streaming Interaction ====================

export const InteractionChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), text: z.string() }),
  z.object({
    type: z.literal('end'),
    reason: z.enum(['completed']),
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
    sessionCompleted: z.boolean(),
    lessonProgress: z.object({ currentStep: z.number(), totalSteps: z.number() }),
  }),
]);
export type InteractionChunk = z.infer<typeof InteractionChunkSchema>;

// ==================== Recipe CRUD DTOs ====================

// Step script schemas per stepType
const StepTransitionSchema = z.object({
  text: z.string().min(1),
});

const ContentChunkSchema = z.object({
  text: z.string().min(1),
  pauseAfter: z.number().int().min(0),
});

const StepContentSchema2 = z.object({
  text: z.string().min(1),
  chunks: z.array(ContentChunkSchema).min(1),
});

const StepExampleSchema = z.object({
  text: z.string().min(1),
  visual: z
    .object({
      type: z.enum(['image', 'animation', 'equation']),
      src: z.string().url().optional(),
    })
    .optional(),
});

const StepComprehensionCheckSchema = z.object({
  question: z.string().min(1),
  expectedAnswer: z.string().min(1),
  feedback: z.object({
    correct: z.string().min(1),
    incorrect: z.string().min(1),
  }),
});

const StepClosureSchema = z.object({
  text: z.string().min(1),
});

// Full step script for content type
const StepScriptSchemaContent = z.object({
  transition: StepTransitionSchema,
  content: StepContentSchema2,
  examples: z.array(StepExampleSchema).min(1),
  comprehensionCheck: StepComprehensionCheckSchema.optional(),
  closure: StepClosureSchema,
});

// Activity script structure (from frontend StepEditor)
const StepScriptSchemaActivity = z.object({
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

// Question script structure (from frontend StepEditor)
const StepScriptSchemaQuestion = z.object({
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

// Discriminated union for activity and question scripts (they have a 'kind' field)
const ActivityOrQuestionSchema = z.discriminatedUnion('kind', [
  StepScriptSchemaActivity,
  StepScriptSchemaQuestion,
]);

// Union of all valid script formats (content + activity/question discriminated union)
export const StepScriptSchema = z.union([StepScriptSchemaContent, ActivityOrQuestionSchema]);

export type StepScript = z.infer<typeof StepScriptSchema>;

// Activity content schema
const ActivityOptionSchema2 = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const ActivityFeedbackSchema = z.object({
  correct: z.string().min(1),
  incorrect: z.string().min(1),
  partial: z.string().optional(),
});

export const ActivityContentSchema2 = z.object({
  instruction: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  options: z.array(ActivityOptionSchema2).optional(),
  feedback: ActivityFeedbackSchema,
});
export type ActivityContent2 = z.infer<typeof ActivityContentSchema2>;

// Question schema for question type steps
const QuestionAnswerSchema = z.object({
  question: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  expectedAnswer: z.string().min(1),
  feedback: z.object({
    correct: z.string().min(1),
    incorrect: z.string().min(1),
  }),
});

export const QuestionSchema = z.object({
  question: z.union([z.string().min(1), z.object({ text: z.string().min(1) })]),
  answer: QuestionAnswerSchema,
});
export type Question = z.infer<typeof QuestionSchema>;

// Recipe Step Input (for creating/updating steps)
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
    activity: ActivityContentSchema2.optional(),
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

// Recipe Output (response)
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

// Create Recipe Input
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

// Update Recipe Input
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

// Reorder Steps Input - relaxed to accept any non-empty strings for debugging
export const ReorderStepsInputSchema = z.object({
  stepIds: z.array(z.string()).min(1),
});
export type ReorderStepsInput = z.infer<typeof ReorderStepsInputSchema>;

// ==================== Input Validation Security Schemas ====================

// TTS Streaming Query
export const TTSStreamQuerySchema = z.object({
  text: z.string().min(1),
  lang: z.string().optional(),
  slow: z.boolean().optional(),
});
export type TTSStreamQuery = z.infer<typeof TTSStreamQuerySchema>;

// Mission Report
export const GetMissionReportParamsSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetMissionReportParams = z.infer<typeof GetMissionReportParamsSchema>;

// User Management
export const GetUserParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetUserParams = z.infer<typeof GetUserParamsSchema>;

export const DeleteUserParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type DeleteUserParams = z.infer<typeof DeleteUserParamsSchema>;

// Session Operations
export const CompleteSessionParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type CompleteSessionParams = z.infer<typeof CompleteSessionParamsSchema>;

export const ReplaySessionParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type ReplaySessionParams = z.infer<typeof ReplaySessionParamsSchema>;

export const SuggestImprovementsParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type SuggestImprovementsParams = z.infer<typeof SuggestImprovementsParamsSchema>;

// Step Operations
export const DeleteStepParamsSchema = z.object({
  stepId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type DeleteStepParams = z.infer<typeof DeleteStepParamsSchema>;

// Class Management
export const GetClassParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetClassParams = z.infer<typeof GetClassParamsSchema>;

export const ListClassesOptionsSchema = z.object({
  status: z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  tutorId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});
export type ListClassesOptions = z.infer<typeof ListClassesOptionsSchema>;

export const RemoveLessonParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  lessonId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type RemoveLessonParams = z.infer<typeof RemoveLessonParamsSchema>;

export const PublishClassParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type PublishClassParams = z.infer<typeof PublishClassParamsSchema>;

export const UnpublishClassParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type UnpublishClassParams = z.infer<typeof UnpublishClassParamsSchema>;

export const DeleteClassParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type DeleteClassParams = z.infer<typeof DeleteClassParamsSchema>;

// Recipe Operations
export const GetRecipeParamsSchema = z.object({
  recipeId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});
export type GetRecipeParams = z.infer<typeof GetRecipeParamsSchema>;

export const ListRecipesQuerySchema = z.object({
  activeOnly: z.boolean().optional(),
});
export type ListRecipesQuery = z.infer<typeof ListRecipesQuerySchema>;
