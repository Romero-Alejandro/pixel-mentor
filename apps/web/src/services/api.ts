import axios from 'axios';
import {
  UserSchema,
  AuthResponseSchema,
  RecipeSchema,
  SessionSchema,
  StartRecipeOutputSchema,
  InteractRecipeOutputSchema,
  QuestionAnswerOutputSchema,
  type User,
  type Role,
  type Recipe,
  type Session,
  type PedagogicalState,
} from '@pixel-mentor/shared';

import { useAuthStore } from '../stores/authStore';

export { type User, type Role, type Recipe, type Session, type PedagogicalState };

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
  const url = `/api/recipe/interact/stream?sessionId=${encodeURIComponent(sessionId)}&studentInput=${encodeURIComponent(studentInput)}`;
  return new EventSource(url);
};

export const api = {
  login: async (data: Pick<User, 'email'> & { password: string }) => {
    const { data: res } = await apiClient.post('/api/auth/login', data);
    return AuthResponseSchema.parse(res);
  },
  register: async (data: { email: string; password: string; name: string; role: Role }) => {
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
  streamInteractWithRecipe,
};
