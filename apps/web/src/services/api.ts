import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source';
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
} from '@pixel-mentor/shared';

import { apiClient, getToken } from './api-client';
import { isValidUUID } from '@/utils/uuid';

import { logger } from '@/utils/logger';

export {
  type User,
  type Role,
  type Recipe,
  type RecipeStep,
  type Session,
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
export { apiClient, getToken } from './api-client';

// Re-export token functions for backward compatibility
export { setToken, clearToken } from './api-client';

export interface StreamInteractHandlers {
  onMessage: (event: EventSourceMessage) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export const streamInteractWithRecipe = (
  sessionId: string,
  studentInput: string,
  handlers: StreamInteractHandlers,
): AbortController => {
  if (import.meta.env.VITE_ENABLE_STREAMING !== 'true') {
    throw new Error('Streaming disabled');
  }
  const token = getToken();
  if (!token) {
    console.error('[API] Authentication token required for streaming');
    throw new Error('Authentication token required for streaming');
  }
  logger.log('[API] Starting fetchEventSource for streaming:', {
    sessionId,
    studentInput: studentInput.slice(0, 50),
  });

  const controller = new AbortController();

  fetchEventSource('/api/recipe/interact/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, studentInput }),
    signal: controller.signal,
    onmessage: handlers.onMessage,
    onerror: (error) => {
      handlers.onError(error);
      throw error;
    },
    onclose: handlers.onClose,
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      handlers.onError(err);
    }
  });

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
  startClassDemo: async (classId: string) => {
    const { data } = await apiClient.post(`/api/classes/${classId}/demo`);
    return {
      sessionId: data.sessionId,
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
  getClassIdByLessonId: async (lessonId: string) => {
    const { data } = await apiClient.get(`/api/classes/lessons/${lessonId}/class`);
    return data.classId;
  },
  interactWithRecipe: async (sessionId: string, studentInput: string) => {
    const { data } = await apiClient.post('/api/recipe/interact', { sessionId, studentInput });
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
    return data as {
      xpEarned: number;
      accuracy: number;
      conceptsMastered: string[];
      currentLevel: number;
      levelTitle: string;
      newBadges: Array<{ code: string; name: string; icon: string }>;
      totalXP: number;
      currentStreak: number;
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
  getClass: async (classId: string) => {
    api.validateId(classId, 'Class');
    const { data } = await apiClient.get(`/api/classes/${classId}`);
    return data;
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
    return ClassTemplateSchema.array().parse(data);
  },
  createClassTemplate: async (data: ClassTemplateCreate) => {
    const { data: res } = await apiClient.post(
      '/api/class-templates',
      ClassTemplateCreateSchema.parse(data),
    );
    return ClassTemplateSchema.parse(res);
  },
  createClassFromTemplate: async (templateId: string, title: string) => {
    api.validateId(templateId, 'ClassTemplate');
    const { data } = await apiClient.post(`/api/class-templates/${templateId}/create-class`, {
      title,
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
    console.log('[API updateRecipe] Request:', { recipeId, data });
    const { data: res } = await apiClient.patch(`/api/recipes/${recipeId}`, data);
    console.log('[API updateRecipe] Response:', res);
    console.log('[API updateRecipe] Parsing with RecipeSchema...');
    const parsed = RecipeSchema.parse(res);
    console.log('[API updateRecipe] Parsed successfully:', parsed);
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
    console.log('[API addStep] Sending request:', { recipeId, step: JSON.stringify(step) });
    try {
      const { data } = await apiClient.post(`/api/recipes/${recipeId}/steps`, step);
      return data as RecipeStep;
    } catch (err: any) {
      console.error('[API addStep] Error response:', {
        status: err.response?.status,
        data: err.response?.data,
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
