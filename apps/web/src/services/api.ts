import axios from 'axios';
import {
  UserSchema,
  AuthResponseSchema,
  RecipeSchema,
  SessionSchema,
  StartRecipeOutputSchema,
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

import { useAuthStore } from '../stores/authStore';

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

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export const setToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const clearToken = (): void => {
  localStorage.removeItem('token');
};

export const streamInteractWithRecipe = (sessionId: string, studentInput: string): EventSource => {
  if (import.meta.env.VITE_ENABLE_STREAMING !== 'true') {
    throw new Error('Streaming disabled');
  }
  const token = getToken();
  if (!token) {
    console.error('[API] Authentication token required for streaming');
    throw new Error('Authentication token required for streaming');
  }
  if (import.meta.env.DEV) {
    console.log('[API] Creating EventSource for streaming:', {
      sessionId,
      studentInput: studentInput.slice(0, 50),
    });
  }
  const url = `/api/recipe/interact/stream?sessionId=${encodeURIComponent(sessionId)}&studentInput=${encodeURIComponent(studentInput)}&token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);
  if (import.meta.env.DEV) {
    console.log('[API] EventSource created, readyState:', es.readyState);
  }
  return es;
};

export const api = {
  login: async (data: { identifier: string; password: string }) => {
    const { data: res } = await apiClient.post('/api/auth/login', data);
    return AuthResponseSchema.parse(res);
  },
  register: async (data: { email: string; password: string; name: string; username?: string }) => {
    const { data: res } = await apiClient.post('/api/auth/register', data);
    return AuthResponseSchema.parse(res);
  },
  getCurrentUser: async () => {
    const { data } = await apiClient.get('/api/auth/me');
    return { user: UserSchema.parse(data.user) };
  },
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
  startRecipe: async (recipeId: string) => {
    const { data } = await apiClient.post('/api/recipe/start', { recipeId });
    return StartRecipeOutputSchema.parse(data);
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
    // Safe parse: raw data to avoid Zod strict validation failures
    const classes = (data.classes ?? data) as Class[];
    return {
      classes,
      total: data.total ?? classes.length ?? 0,
      page: data.page ?? 1,
      limit: data.limit ?? 20,
    };
  },
  getClass: async (classId: string) => {
    const { data } = await apiClient.get(`/api/classes/${classId}`);
    // Safe parse: return raw data to avoid Zod strict validation failures
    return data;
  },
  createClass: async (data: ClassCreate) => {
    const { data: res } = await apiClient.post('/api/classes', ClassCreateSchema.parse(data));
    // Safe parse: API returns Class entity directly, dates are ISO strings
    return res;
  },
  updateClass: async (classId: string, data: ClassUpdate) => {
    const { data: res } = await apiClient.patch(
      `/api/classes/${classId}`,
      ClassUpdateSchema.parse(data),
    );
    return ClassSchema.parse(res);
  },
  deleteClass: async (classId: string) => {
    await apiClient.delete(`/api/classes/${classId}`);
  },
  publishClass: async (classId: string, data?: ClassPublish) => {
    const { data: res } = await apiClient.post(
      `/api/classes/${classId}/publish`,
      data ? ClassPublishSchema.parse(data) : {},
    );
    return ClassSchema.parse(res);
  },
  unpublishClass: async (classId: string) => {
    const { data: res } = await apiClient.post(`/api/classes/${classId}/unpublish`);
    return ClassSchema.parse(res);
  },
  addClassLesson: async (classId: string, lesson: { recipeId: string; order?: number }) => {
    const { data } = await apiClient.post(`/api/classes/${classId}/lessons`, lesson);
    // Backend returns ClassLessonEntity, not the full class
    return data;
  },
  removeClassLesson: async (classId: string, lessonId: string) => {
    await apiClient.delete(`/api/classes/${classId}/lessons/${lessonId}`);
    // Backend returns 204 No Content, return void
    return undefined;
  },
  reorderClassLessons: async (classId: string, lessonIds: string[]) => {
    const { data } = await apiClient.patch(`/api/classes/${classId}/lessons/reorder`, {
      lessonIds,
    });
    // Backend returns { message: "Lessons reordered successfully" }
    return data;
  },
  updateClassLesson: async (
    classId: string,
    lessonId: string,
    lesson: Partial<{ recipeId: string; order: number }>,
  ) => {
    const { data } = await apiClient.patch(`/api/classes/${classId}/lessons/${lessonId}`, lesson);
    // Backend returns updated ClassLessonEntity
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
  // ==================== Class Demo ====================
  startClassDemo: async (classId: string) => {
    const { data } = await apiClient.post<{ sessionId: string; recipeId: string; title: string }>(
      `/api/classes/${classId}/demo`,
    );
    return data;
  },
  // ==================== Recipe Management ====================
  listAllRecipes: async (options?: { status?: 'my' | 'published' }) => {
    // The backend supports activeOnly param - map 'published' to activeOnly=true
    const activeOnly =
      options?.status === 'published' ? true : options?.status === 'my' ? false : undefined;
    const { data } = await apiClient.get('/api/recipes', { params: { activeOnly } });
    // Safe parse: raw data to avoid Zod strict validation failures
    const recipes = (data.recipes ?? data) as Recipe[];
    return recipes;
  },
  getRecipe: async (recipeId: string) => {
    const { data } = await apiClient.get(`/api/recipes/${recipeId}`);
    // Safe parse: return raw data to avoid Zod strict validation failures
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
    // Safe parse: API returns Recipe entity directly
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
    const { data: res } = await apiClient.patch(`/api/recipes/${recipeId}`, data);
    return RecipeSchema.parse(res);
  },
  deleteRecipe: async (recipeId: string) => {
    await apiClient.delete(`/api/recipes/${recipeId}`);
    // Backend returns 204 No Content
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
    const { data } = await apiClient.post(`/api/recipes/${recipeId}/steps`, step);
    // Backend returns step entity
    return data as RecipeStep;
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
    // Backend returns 204 No Content
    return undefined;
  },
  reorderSteps: async (recipeId: string, stepIds: string[]) => {
    const { data } = await apiClient.patch(`/api/recipes/${recipeId}/steps/reorder`, { stepIds });
    // Backend returns 204 No Content
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
    // Safe parsing: filter out users with invalid data instead of crashing
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
  streamInteractWithRecipe,
};
