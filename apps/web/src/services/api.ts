import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';
import type { ActivityResponse } from '@pixel-mentor/shared/activities';
import {
  RecipeSchema,
  SessionSchema,
  InteractRecipeOutputSchema,
  QuestionAnswerOutputSchema,
  ClassSchema,
  ClassCreateSchema,
  ClassUpdateSchema,
  ClassPublishSchema,
  ClassTemplateSchema,
  ClassTemplateCreateSchema,
  GenerateClassDraftInputSchema,
  GenerateClassDraftOutputSchema,
  type User,
  type Role,
  type Recipe,
  type RecipeStep,
  type Session,
  type SessionStatus,
  type PedagogicalState,
  type Class,
  type ClassCreate,
  type ClassUpdate,
  type ClassPublish,
  type ClassTemplate,
  type ClassTemplateCreate,
  type GenerateClassDraftInput,
  type GenerateClassDraftOutput,
  type ClassLesson,
  type StartRecipeOutput,
} from '@pixel-mentor/shared';

import { z } from 'zod';
import {
  DiscrepancySchema,
  PragmaticModuleSchema,
  type Discrepancy as SharedDiscrepancy,
  type PragmaticModuleData as SharedPragmaticModuleData,
} from '@pixel-mentor/shared/schemas/clinical';

import { apiClient, getToken } from '@/services/api-client';
import { isValidUUID } from '@/utils/uuid';
import {
  SSE_RETRY_DEFAULTS,
  calculateBackoffDelay,
  classifySSEError,
  type SSERetryConfig,
} from '@/services/sse-retry';

import { logger } from '@/utils/logger';

export {
  type User,
  type Role,
  type Recipe,
  type RecipeStep,
  type Session,
  type SessionStatus,
  type PedagogicalState,
  type Class,
  type ClassCreate,
  type ClassUpdate,
  type ClassPublish,
  type ClassTemplate,
  type ClassTemplateCreate,
  type GenerateClassDraftInput,
  type GenerateClassDraftOutput,
  type ClassLesson,
};

// Re-export apiClient for backward compatibility
export { apiClient, getToken } from '@/services/api-client';

// Re-export token functions for backward compatibility
export { setToken, clearToken } from '@/services/api-client';

export interface StreamInteractHandlers {
  onMessage: (event: EventSourceMessage) => void;
  onError: (error: Error) => void;
  /**
   * Called when the SSE connection closes.
   * @param reason - Why the connection closed:
   *   - 'completed': Normal close after end event
   *   - 'error': Close due to error after max retries
   *   - 'aborted': Client-side abort
   *   - 'unknown': Close without clear reason
   */
  onClose: (reason?: 'completed' | 'error' | 'aborted' | 'unknown') => void;
}

export interface StreamInteractRetryConfig extends Partial<SSERetryConfig> {
  /** Called on each retry attempt with status info */
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void;
}

export const streamInteractWithRecipe = (
  sessionId: string,
  studentInput: string,
  optionId: string | undefined,
  handlers: StreamInteractHandlers,
  retryConfig?: StreamInteractRetryConfig,
  activityResponse?: ActivityResponse,
): AbortController => {
  if (import.meta.env.VITE_ENABLE_STREAMING !== 'true') {
    throw new Error('Streaming disabled');
  }
  const token = getToken();
  if (!token) {
    logger.error('[API] Authentication token required for streaming');
    throw new Error('Authentication token required for streaming');
  }
  logger.log('[API] Starting fetchEventSource for streaming:', {
    sessionId,
    studentInput: studentInput.slice(0, 50),
  });

  const config: SSERetryConfig = {
    ...SSE_RETRY_DEFAULTS,
    ...retryConfig,
  };

  const controller = new AbortController();
  let retryCount = 0;
  let endReceived = false;
  let totalRetries = 0;

  // Generate a unique interaction ID for deduplication across retries
  const interactionId = crypto.randomUUID();

  const connect = (): void => {
    fetchEventSource('/api/recipe/interact/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId,
        studentInput,
        ...(optionId ? { optionId } : {}),
        ...(activityResponse ? { activityResponse } : {}),
        interactionId,
      }),
      signal: controller.signal,
      onmessage: (event) => {
        if (event.event === 'end') endReceived = true;
        handlers.onMessage(event);
      },
      onerror: (error) => {
        // If aborted or end event was already received, don't retry
        if (controller.signal.aborted || endReceived) return;

        // Classify the error
        const classification = classifySSEError(error);

        if (!classification.retryable) {
          logger.error(`[API] SSE non-retryable error (${classification.type}):`, error);
          handlers.onError(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        if (retryCount < config.maxRetries) {
          retryCount++;
          totalRetries++;
          const delay = calculateBackoffDelay(retryCount - 1, config);

          logger.warn(
            `[API] SSE ${classification.type} error, retry ${retryCount}/${config.maxRetries} in ${delay}ms`,
            error,
          );

          // Notify UI about retry
          retryConfig?.onRetry?.(retryCount, config.maxRetries, delay);

          // Return without throwing — fetch-event-source will retry after this delay
          return;
        }

        // Max retries exceeded — report error and stop
        logger.error(
          `[API] SSE max retries (${config.maxRetries}) exceeded after ${totalRetries} total retries`,
          error,
        );
        handlers.onError(error instanceof Error ? error : new Error(String(error)));
      },
      onclose: () => {
        const prevRetryCount = retryCount;
        retryCount = 0; // Reset for next connection attempt
        if (controller.signal.aborted) {
          handlers.onClose('aborted');
        } else if (endReceived) {
          handlers.onClose('completed');
        } else if (prevRetryCount >= config.maxRetries) {
          handlers.onClose('error');
        } else {
          handlers.onClose('unknown');
        }
      },
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        handlers.onError(err);
      }
    });
  };

  connect();
  logger.log('[API] fetchEventSource started for streaming');

  return controller;
};

export const api = {
  validateId: (id: string, name: string) => {
    if (!isValidUUID(id)) {
      throw new Error(`Invalid ${name} ID format: ${id}. Expected UUID.`);
    }
  },
  // Auth methods moved to features/auth/services/auth.api.ts
  listRecipes: async (activeOnly = true) => {
    const { data } = await apiClient.get(`/api/recipes?activeOnly=${activeOnly}`);
    return RecipeSchema.array().parse(data);
  },
  listSessions: async (studentId: string, activeOnly = false) => {
    const { data } = await apiClient.get(
      `/api/sessions?studentId=${studentId}&activeOnly=${activeOnly}`,
    );
    return SessionSchema.array().parse(data);
  },
  startClass: async (classId: string) => {
    const { data } = await apiClient.post(`/api/student/classes/${classId}/start`);
    return {
      sessionId: data.sessionId,
      pedagogicalState: data.pedagogicalState,
      voiceText: data.voiceText,
      meta: data.meta,
      isRepeat: data.isRepeat,
      resumed: data.resumed,
      needsStart: data.needsStart,
      staticContent: data.staticContent,
      lessonProgress: data.lessonProgress,
      contentSteps: data.contentSteps,
      recipeId: data.recipeId,
      title: data.title,
    };
  },
  getClassIdByLessonId: async (lessonId: string) => {
    const { data } = await apiClient.get(`/api/classes/lessons/${lessonId}/class`);
    return data.classId;
  },
  interactWithRecipe: async (
    sessionId: string,
    studentInput: string,
    optionId?: string,
    activityResponse?: ActivityResponse,
  ) => {
    const { data } = await apiClient.post('/api/recipe/interact', {
      sessionId,
      studentInput,
      ...(optionId ? { optionId } : {}),
      ...(activityResponse ? { activityResponse } : {}),
    });
    return InteractRecipeOutputSchema.parse(data);
  },
  getSession: async (sessionId: string) => {
    const { data } = await apiClient.get(`/api/sessions/${sessionId}`);
    return SessionSchema.parse(data);
  },
  resetSession: async (sessionId: string) => {
    const { data } = await apiClient.post(`/api/sessions/${sessionId}/replay`);
    return SessionSchema.parse(data);
  },
  askQuestion: async (recipeId: string, question: string) => {
    const { data } = await apiClient.post('/api/recipe/question', { recipeId, question });
    return QuestionAnswerOutputSchema.parse(data);
  },
  completeSession: async (sessionId: string) => {
    const { data } = await apiClient.post(`/api/sessions/${sessionId}/complete`);
    return SessionSchema.parse(data);
  },
  getMissionReport: async (sessionId: string) => {
    const { data } = await apiClient.get(`/api/gamification/mission-report/${sessionId}`);
    const MissionReportResponseSchema = z.object({
      xpEarned: z.number(),
      totalXP: z.number(),
      currentLevel: z.number(),
      levelTitle: z.string(),
      xpToNextLevel: z.number().optional(),
      newBadges: z.array(
        z.object({
          code: z.string(),
          name: z.string(),
          icon: z.string(),
          xpReward: z.number().optional(),
        }),
      ),
      levelUp: z
        .object({ from: z.number(), to: z.number(), title: z.string() })
        .nullable()
        .optional(),
      streakDays: z.number().optional(),
      currentStreak: z.number().optional(),
      accuracy: z.number().optional(),
      conceptsMastered: z.array(z.string()),
      /** ⚠️ true = sección clínica simulada (placeholder), ver MissionReportPage. */
      clinicalReportSimulated: z.boolean().optional(),
      clinicalDiscrepancies: z.array(DiscrepancySchema).optional().default([]),
      pragmaticModule: PragmaticModuleSchema.optional(),
    });
    const parsed = MissionReportResponseSchema.parse(data);
    const normalized = {
      ...parsed,
      accuracy: parsed.accuracy ?? 100,
      currentStreak: parsed.currentStreak ?? parsed.streakDays ?? 0,
      streakDays: parsed.streakDays ?? parsed.currentStreak ?? 0,
    };
    return normalized as {
      xpEarned: number;
      totalXP: number;
      currentLevel: number;
      levelTitle: string;
      xpToNextLevel?: number;
      newBadges: Array<{ code: string; name: string; icon: string; xpReward?: number }>;
      levelUp?: { from: number; to: number; title: string } | null;
      streakDays?: number;
      currentStreak?: number;
      accuracy: number;
      conceptsMastered: string[];
      clinicalReportSimulated?: boolean;
      clinicalDiscrepancies: SharedDiscrepancy[];
      pragmaticModule?: SharedPragmaticModuleData;
    };
  },
  // ==================== Classes ====================
  listClasses: async (status?: string) => {
    const url = status ? `/api/classes?status=${status}` : '/api/classes';
    const { data } = await apiClient.get(url);
    const classes = (data.classes ?? data) as Class[];
    return {
      classes,
      total: data.total ?? classes.length ?? 0,
      page: data.page ?? 1,
      limit: data.limit ?? 20,
    };
  },
  getMyClasses: async () => {
    const { data } = await apiClient.get('/api/classes?status=PUBLISHED');
    const classes = (data.classes ?? data) as Class[];
    return classes;
  },
  getClass: async (classId: string): Promise<Class> => {
    api.validateId(classId, 'Class');
    const { data } = await apiClient.get(`/api/classes/${classId}`);
    return data as Class;
  },
  createClass: async (data: ClassCreate) => {
    const { data: res } = await apiClient.post('/api/classes', ClassCreateSchema.parse(data));
    return res;
  },
  updateClass: async (classId: string, data: ClassUpdate) => {
    api.validateId(classId, 'Class');
    const { data: res } = await apiClient.patch(
      `/api/classes/${classId}`,
      ClassUpdateSchema.parse(data),
    );
    return ClassSchema.parse(res);
  },
  deleteClass: async (classId: string) => {
    api.validateId(classId, 'Class');
    await apiClient.delete(`/api/classes/${classId}`);
  },
  publishClass: async (classId: string, data?: ClassPublish) => {
    api.validateId(classId, 'Class');
    const { data: res } = await apiClient.post(
      `/api/classes/${classId}/publish`,
      data ? ClassPublishSchema.parse(data) : {},
    );
    return ClassSchema.parse(res);
  },
  unpublishClass: async (classId: string) => {
    api.validateId(classId, 'Class');
    const { data: res } = await apiClient.post(`/api/classes/${classId}/unpublish`);
    return ClassSchema.parse(res);
  },
  /**
   * Tutor preview: starts a session on the first lesson as if the tutor were
   * a student, so they can experience the class before publishing.
   */
  previewClass: async (
    classId: string,
  ): Promise<{ sessionId: string; voiceText: string; title: string | null }> => {
    api.validateId(classId, 'Class');
    const { data } = await apiClient.post(`/api/classes/${classId}/preview`);
    return {
      sessionId: data.sessionId,
      voiceText: data.voiceText,
      title: data.title ?? null,
    };
  },
  addClassLesson: async (classId: string, lesson: { recipeId: string; order?: number }) => {
    api.validateId(classId, 'Class');
    const { data } = await apiClient.post(`/api/classes/${classId}/lessons`, lesson);
    return data;
  },
  removeClassLesson: async (classId: string, lessonId: string) => {
    api.validateId(classId, 'Class');
    // Assuming lessonId is also a UUID for consistency. Add validation for lessonId.
    api.validateId(lessonId, 'Lesson');
    await apiClient.delete(`/api/classes/${classId}/lessons/${lessonId}`);
    return undefined;
  },
  reorderClassLessons: async (classId: string, lessonIds: string[]) => {
    api.validateId(classId, 'Class');
    // Assuming lessonIds are also UUIDs. Validate each one.
    for (const id of lessonIds) api.validateId(id, 'Lesson');
    const { data } = await apiClient.patch(`/api/classes/${classId}/lessons/reorder`, {
      lessonIds,
    });
    return data;
  },
  updateClassLesson: async (
    classId: string,
    lessonId: string,
    lesson: Partial<{ recipeId: string; order: number }>,
  ) => {
    api.validateId(classId, 'Class');
    api.validateId(lessonId, 'Lesson');
    const { data } = await apiClient.patch(`/api/classes/${classId}/lessons/${lessonId}`, lesson);
    return data;
  },
  // ==================== Class Templates ====================
  listClassTemplates: async () => {
    const { data } = await apiClient.get('/api/class-templates');
    // API returns { templates: [...] }
    return z.object({ templates: z.array(ClassTemplateSchema) }).parse(data).templates;
  },
  createClassTemplate: async (data: ClassTemplateCreate) => {
    const { data: res } = await apiClient.post(
      '/api/class-templates',
      ClassTemplateCreateSchema.parse(data),
    );
    return ClassTemplateSchema.parse(res);
  },
  createClassFromTemplate: async (templateId: string, title?: string) => {
    api.validateId(templateId, 'ClassTemplate');
    // Title is optional: when omitted the API falls back to the template's name.
    const { data } = await apiClient.post(`/api/class-templates/${templateId}/create-class`, {
      ...(title ? { title } : {}),
    });
    return ClassSchema.parse(data);
  },
  // ==================== AI Generation ====================
  generateClassDraft: async (input: GenerateClassDraftInput) => {
    const { data } = await apiClient.post(
      '/api/classes/ai/generate',
      GenerateClassDraftInputSchema.parse(input),
    );
    return GenerateClassDraftOutputSchema.parse(data);
  },

  // ==================== Recipe Management ====================
  listAllRecipes: async (options?: { isMy?: boolean; publishedOnly?: boolean }) => {
    const params: Record<string, string> = {};
    if (options?.isMy !== undefined) params.isMy = String(options.isMy);
    if (options?.publishedOnly !== undefined) params.publishedOnly = String(options.publishedOnly);
    const { data } = await apiClient.get('/api/recipes', { params });
    const recipes = (data.recipes ?? data) as Recipe[];
    return recipes;
  },
  getRecipe: async (recipeId: string) => {
    const { data } = await apiClient.get(`/api/recipes/${recipeId}`);
    return data as Recipe;
  },
  createRecipe: async (data: {
    title: string;
    description?: string;
    expectedDurationMinutes?: number;
    moduleId?: string;
    published?: boolean;
    steps?: Array<{
      atomId?: string;
      order?: number;
      conceptId?: string;
      activityId?: string;
      stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
      script?: Record<string, unknown>;
      activity?: Record<string, unknown>;
      question?: Record<string, unknown>;
    }>;
  }) => {
    const { data: res } = await apiClient.post('/api/recipes', data);
    return res as Recipe;
  },
  updateRecipe: async (
    recipeId: string,
    data: {
      title?: string;
      description?: string;
      expectedDurationMinutes?: number;
      moduleId?: string;
      published?: boolean;
    },
  ) => {
    logger.log('[API updateRecipe] Request:', { recipeId, data });
    const { data: res } = await apiClient.patch(`/api/recipes/${recipeId}`, data);
    logger.log('[API updateRecipe] Response:', res);
    logger.log('[API updateRecipe] Parsing with RecipeSchema...');
    const parsed = RecipeSchema.parse(res);
    logger.log('[API updateRecipe] Parsed successfully:', parsed);
    return parsed;
  },
  deleteRecipe: async (recipeId: string) => {
    await apiClient.delete(`/api/recipes/${recipeId}`);
    return undefined;
  },
  addStep: async (
    recipeId: string,
    step: {
      atomId?: string;
      order?: number;
      conceptId?: string;
      activityId?: string;
      stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
      script?: Record<string, unknown>;
      activity?: Record<string, unknown>;
      question?: Record<string, unknown>;
    },
  ) => {
    logger.log('[API addStep] Sending request:', { recipeId, step: JSON.stringify(step) });
    try {
      const { data } = await apiClient.post(`/api/recipes/${recipeId}/steps`, step);
      return data as RecipeStep;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      logger.error('[API addStep] Error response:', {
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
      });
      throw err;
    }
  },
  updateStep: async (
    recipeId: string,
    stepId: string,
    step: {
      atomId?: string;
      order?: number;
      conceptId?: string;
      activityId?: string;
      stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
      script?: Record<string, unknown>;
      activity?: Record<string, unknown>;
      question?: Record<string, unknown>;
    },
  ) => {
    const { data } = await apiClient.patch(`/api/recipes/${recipeId}/steps/${stepId}`, step);
    return data as RecipeStep;
  },
  deleteStep: async (recipeId: string, stepId: string) => {
    await apiClient.delete(`/api/recipes/${recipeId}/steps/${stepId}`);
    return undefined;
  },
  reorderSteps: async (recipeId: string, stepIds: string[]) => {
    const { data } = await apiClient.patch(`/api/recipes/${recipeId}/steps/reorder`, { stepIds });
    return data;
  },
  // ==================== Recipe Demo ====================
  startRecipeDemo: async (
    recipeId: string,
  ): Promise<
    StartRecipeOutput & {
      /** Class lesson backing the session, when the recipe was started from a class. */
      classLessonId: string | null;
      recipeId?: string;
      title?: string;
    }
  > => {
    api.validateId(recipeId, 'Recipe');
    const { data } = await apiClient.post('/api/sessions/start-recipe', { recipeId });
    return {
      sessionId: data.sessionId,
      classLessonId: data.classLessonId ?? null,
      pedagogicalState: data.pedagogicalState,
      voiceText: data.voiceText,
      meta: data.meta,
      isRepeat: data.isRepeat,
      lessonProgress: data.lessonProgress,
      contentSteps: data.contentSteps,
      recipeId: data.recipeId,
      title: data.title,
    };
  },
  // ==================== Admin ====================
  listUsers: async (options?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.role) params.set('role', options.role);
    if (options?.search) params.set('search', options.search);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const { data } = await apiClient.get(`/api/admin/users?${params.toString()}`);
    const users = (data.users ?? []).map((u: Record<string, unknown>) => ({
      id: String(u.id ?? ''),
      email: String(u.email ?? ''),
      username: u.username ? String(u.username) : undefined,
      name: String(u.name ?? ''),
      role: String(u.role ?? 'STUDENT'),
      createdAt: String(u.createdAt ?? ''),
    }));
    return {
      users,
      total: data.total ?? 0,
      page: data.page ?? 1,
      limit: data.limit ?? 20,
      totalPages: data.totalPages ?? 1,
    };
  },
  adminCreateUser: async (input: {
    email: string;
    password: string;
    name: string;
    username?: string;
    role: string;
    age?: number;
  }) => {
    const { data } = await apiClient.post('/api/admin/users', input);
    return data.user;
  },
  adminUpdateUserRole: async (userId: string, role: string) => {
    const { data } = await apiClient.patch(`/api/admin/users/${userId}/role`, { role });
    return data.user;
  },
  adminDeleteUser: async (userId: string) => {
    await apiClient.delete(`/api/admin/users/${userId}`);
  },
};
