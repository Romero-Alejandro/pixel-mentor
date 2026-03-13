import axios from 'axios';
import { z } from 'zod';

import { useAuthStore } from '../stores/authStore';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
  age: z.number().optional(),
  quota: z.number(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
});

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  concepts: z.array(z.any()).optional(),
  questions: z.array(z.any()).optional(),
});

export const PedagogicalStateSchema = z.enum([
  'ACTIVE_CLASS',
  'RESOLVING_DOUBT',
  'EXPLANATION',
  'QUESTION',
  'EVALUATION',
]);

export const SessionSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  lessonId: z.string(),
  status: z.string(),
  stateCheckpoint: z
    .object({
      currentState: PedagogicalStateSchema,
      currentSegmentIndex: z.number(),
      currentQuestionIndex: z.number(),
      savedSegmentIndex: z.number().optional(),
      doubtContext: z
        .object({
          question: z.string(),
          chunkIndex: z.number(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  startedAt: z.string().optional(),
  lastActivityAt: z.string().optional(),
  completedAt: z.string().nullish(),
  escalatedAt: z.string().nullish(),
  version: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  safetyFlag: z.string().nullish(),
  outOfScope: z.boolean().nullish(),
  failedAttempts: z.number().nullish(),
});

export const StartLessonResponseSchema = z.object({
  sessionId: z.string(),
  voiceText: z.string(),
  pedagogicalState: PedagogicalStateSchema,
});

export const InteractLessonResponseSchema = z.object({
  voiceText: z.string(),
  pedagogicalState: PedagogicalStateSchema,
  sessionCompleted: z.boolean().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type Role = z.infer<typeof UserSchema>['role'];
export type Lesson = z.infer<typeof LessonSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type StartLessonResponse = z.infer<typeof StartLessonResponseSchema>;
export type InteractLessonResponse = z.infer<typeof InteractLessonResponseSchema>;
export type PedagogicalState = z.infer<typeof PedagogicalStateSchema>;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
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
    return z.object({ user: UserSchema }).parse(data);
  },
  listLessons: async (activeOnly = true) => {
    const { data } = await apiClient.get(`/api/lessons?activeOnly=${activeOnly}`);
    return z.array(LessonSchema).parse(data);
  },
  listSessions: async (studentId: string, activeOnly = false) => {
    const { data } = await apiClient.get(
      `/api/sessions?studentId=${studentId}&activeOnly=${activeOnly}`,
    );
    return z.array(SessionSchema).parse(data);
  },
  startLesson: async (lessonId: string) => {
    const { data } = await apiClient.post('/api/leccion/start', { lessonId });
    return StartLessonResponseSchema.parse(data);
  },
  interactWithLesson: async (sessionId: string, studentInput: string) => {
    const { data } = await apiClient.post('/api/leccion/interact', { sessionId, studentInput });
    return InteractLessonResponseSchema.parse(data);
  },
  getSession: async (sessionId: string) => {
    const { data } = await apiClient.get(`/api/sessions/${sessionId}`);
    return SessionSchema.parse(data);
  },
  resetSession: async (sessionId: string) => {
    const { data } = await apiClient.post(`/api/sessions/${sessionId}/replay`);
    return SessionSchema.parse(data);
  },
};
