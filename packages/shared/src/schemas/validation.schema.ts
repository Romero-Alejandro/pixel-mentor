import { z } from 'zod';

// ==================== TTS Streaming Query ====================

export const TTSStreamQuerySchema = z.object({
  text: z.string().min(1),
  lang: z.string().optional(),
  slow: z.boolean().optional(),
});

export type TTSStreamQuery = z.infer<typeof TTSStreamQuerySchema>;

// ==================== Mission Report ====================

export const GetMissionReportParamsSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});

export type GetMissionReportParams = z.infer<typeof GetMissionReportParamsSchema>;

// ==================== User Management ====================

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

// ==================== Session Operations ====================

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

// ==================== Step Operations ====================

export const DeleteStepParamsSchema = z.object({
  stepId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});

export type DeleteStepParams = z.infer<typeof DeleteStepParamsSchema>;

// ==================== Class Management ====================

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

// ==================== Recipe Operations ====================

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
