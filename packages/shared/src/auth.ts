import { z } from 'zod';

// ==================== Auth ====================

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

// ==================== Types ====================

export type User = z.infer<typeof UserSchema>;
export type Role = z.infer<typeof UserSchema>['role'];
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
