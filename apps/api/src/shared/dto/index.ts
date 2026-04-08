// Re-export all schemas from shared package for backward compatibility
// This file is kept to preserve existing import paths in the backend

// ==================== Static Content Types ====================
export {
  StepContentSchema,
  type StepContent,
  ActivityOptionSchema,
  type ActivityOption,
  ActivityContentSchema,
  type ActivityContent,
  StaticContentSchema,
  type StaticContent,
} from '@pixel-mentor/shared/schemas/recipe';

// ==================== Recipe Orchestration ====================
export {
  StartRecipeInputSchema,
  type StartRecipeInput,
  StartRecipeOutputSchema,
  type StartRecipeOutput,
  PedagogicalStateSchema,
  type PedagogicalState,
  LessonProgressSchema,
  type LessonProgress,
} from '@pixel-mentor/shared/schemas/orchestration/start-recipe';

export {
  InteractRecipeInputSchema,
  type InteractRecipeInput,
  InteractRecipeOutputSchema,
  type InteractRecipeOutput,
  AccuracySchema,
  type Accuracy,
  AccuracyTierSchema,
} from '@pixel-mentor/shared/schemas/orchestration/interact';

export {
  InteractionChunkSchema,
  type InteractionChunk,
} from '@pixel-mentor/shared/schemas/orchestration/interaction-chunk';

// ==================== Recipe Read ====================
export {
  GetRecipeInputSchema,
  type GetRecipeInput,
  ListRecipesInputSchema,
  type ListRecipesInput,
} from '@pixel-mentor/shared/schemas/recipe';

// ==================== Question Answering ====================
export {
  QuestionAnswerInputSchema,
  type QuestionAnswerInput,
  QuestionAnswerOutputSchema,
  type QuestionAnswerOutput,
} from '@pixel-mentor/shared/schemas/evaluation';

// ==================== Session Read ====================
export {
  GetSessionInputSchema,
  type GetSessionInput,
  ListSessionsInputSchema,
  type ListSessionsInput,
} from '@pixel-mentor/shared/schemas/session';

// ==================== Recipe CRUD DTOs ====================
export {
  StepScriptSchema,
  type StepScript,
  QuestionSchema,
  type Question,
  RecipeStepInputSchema,
  type RecipeStepInput,
  RecipeStepOutputSchema,
  type RecipeStepOutput,
  RecipeOutputSchema,
  type RecipeOutput,
  CreateRecipeInputSchema,
  type CreateRecipeInput,
  UpdateRecipeInputSchema,
  type UpdateRecipeInput,
  ReorderStepsInputSchema,
  type ReorderStepsInput,
} from '@pixel-mentor/shared/schemas/recipe';

// ==================== Input Validation Security Schemas ====================
export {
  TTSStreamQuerySchema,
  type TTSStreamQuery,
  GetMissionReportParamsSchema,
  type GetMissionReportParams,
  GetUserParamsSchema,
  type GetUserParams,
  DeleteUserParamsSchema,
  type DeleteUserParams,
  CompleteSessionParamsSchema,
  type CompleteSessionParams,
  ReplaySessionParamsSchema,
  type ReplaySessionParams,
  SuggestImprovementsParamsSchema,
  type SuggestImprovementsParams,
  DeleteStepParamsSchema,
  type DeleteStepParams,
  GetClassParamsSchema,
  type GetClassParams,
  ListClassesOptionsSchema,
  type ListClassesOptions,
  RemoveLessonParamsSchema,
  type RemoveLessonParams,
  PublishClassParamsSchema,
  type PublishClassParams,
  UnpublishClassParamsSchema,
  type UnpublishClassParams,
  DeleteClassParamsSchema,
  type DeleteClassParams,
  GetRecipeParamsSchema,
  type GetRecipeParams,
  ListRecipesQuerySchema,
  type ListRecipesQuery,
} from '@pixel-mentor/shared/schemas/validation';
