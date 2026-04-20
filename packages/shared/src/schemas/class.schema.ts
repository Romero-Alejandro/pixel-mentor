import { z } from 'zod';

// ==================== Class Status ====================

export const ClassStatusSchema = z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']);

export type ClassStatus = z.infer<typeof ClassStatusSchema>;

// ==================== Class Lesson ====================

export const ClassLessonSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  recipeId: z.string(),
  title: z.string().optional(),
  order: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Recipe data (populated by backend include)
  recipe: z
    .object({
id: z.string().uuid(),
      title: z.string(),
      expectedDurationMinutes: z.number().nullable().optional(),
    })
    .optional(),
});

export const ClassLessonCreateSchema = z.object({
  recipeId: z.string().min(1),
  title: z.string().optional(),
  order: z.number().optional(),
});

export const ClassLessonUpdateSchema = z.object({
  recipeId: z.string().min(1).optional(),
  title: z.string().optional(),
  order: z.number().optional(),
});

export type ClassLesson = z.infer<typeof ClassLessonSchema>;
export type ClassLessonCreate = z.infer<typeof ClassLessonCreateSchema>;
export type ClassLessonUpdate = z.infer<typeof ClassLessonUpdateSchema>;

// ==================== Class Version Lesson ====================

export const ClassVersionLessonSchema = z.object({
  id: z.string().uuid(),
  classVersionId: z.string(),
  recipeId: z.string(),
  order: z.number(),
  recipeSnapshot: z.any().nullable().optional(),
  createdAt: z.string().optional(),
});

export type ClassVersionLesson = z.infer<typeof ClassVersionLessonSchema>;

// ==================== Class ====================

export const ClassSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  tutorId: z.string(),
  classTemplateId: z.string().nullable().optional(),
  currentVersionId: z.string().nullable().optional(),
  status: ClassStatusSchema,
  version: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lessons: z.array(ClassLessonSchema).optional(),
});

// ==================== Class Create/Update ====================

export const ClassCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  classTemplateId: z.string().optional(),
  lessons: z.array(ClassLessonCreateSchema).optional(),
});

export const ClassUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  classTemplateId: z.string().optional(),
  status: ClassStatusSchema.optional(),
  lessons: z.array(ClassLessonCreateSchema).optional(),
});

export const ClassPublishSchema = z.object({
  targetAgeMin: z.number().min(3).max(18).optional(),
  targetAgeMax: z.number().min(3).max(18).optional(),
  objectives: z.array(z.string()).min(3).max(10).optional(),
});

export type Class = z.infer<typeof ClassSchema>;
export type ClassCreate = z.infer<typeof ClassCreateSchema>;
export type ClassUpdate = z.infer<typeof ClassUpdateSchema>;
export type ClassPublish = z.infer<typeof ClassPublishSchema>;

// ==================== Class Version ====================

export const ClassVersionSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  version: z.string(),
  publishedAt: z.string().nullable().optional(),
  isPublished: z.boolean(),
  title: z.string(),
  description: z.string().nullable().optional(),
  slug: z.string(),
  status: ClassStatusSchema,
  lessons: z.array(ClassVersionLessonSchema).optional(),
  createdAt: z.string().optional(),
});

export type ClassVersion = z.infer<typeof ClassVersionSchema>;

// ==================== Class Template ====================

export const ClassTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tutorId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ClassTemplateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const ClassTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export type ClassTemplate = z.infer<typeof ClassTemplateSchema>;
export type ClassTemplateCreate = z.infer<typeof ClassTemplateCreateSchema>;
export type ClassTemplateUpdate = z.infer<typeof ClassTemplateUpdateSchema>;

// ==================== Class Responses ====================

export const ClassListQuerySchema = z.object({
  status: ClassStatusSchema.optional(),
  tutorId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const ClassListResponseSchema = z.object({
  classes: z.array(ClassSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type ClassListQuery = z.infer<typeof ClassListQuerySchema>;
export type ClassListResponse = z.infer<typeof ClassListResponseSchema>;

// ==================== Class Response ====================

export const ClassResponseSchema = ClassSchema;

export type ClassResponse = z.infer<typeof ClassResponseSchema>;

// ==================== AI Generation ====================

export const GenerateClassDraftInputSchema = z.object({
  topic: z.string().min(1).max(500),
  targetAgeMin: z.number().min(3).max(18),
  targetAgeMax: z.number().min(3).max(18),
  objectives: z.array(z.string()).min(3).max(10),
  duration: z.number().min(15).max(180).optional(), // minutes
  availableRecipes: z
    .array(
      z.object({
  id: z.string().uuid(),
        title: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

export const GenerateClassDraftOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  lessons: z.array(
    z.object({
      title: z.string(),
      recipeId: z.string().optional(),
      duration: z.number().optional(),
    }),
  ),
  qualityValidation: z.object({
    passed: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});

export type GenerateClassDraftInput = z.infer<typeof GenerateClassDraftInputSchema>;
export type GenerateClassDraftOutput = z.infer<typeof GenerateClassDraftOutputSchema>;

// ==================== Validation Errors ====================

export const QualityValidationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
});

export type QualityValidationError = z.infer<typeof QualityValidationErrorSchema>;
