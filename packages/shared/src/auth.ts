import { z } from 'zod';

// ==================== Auth ====================

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().optional(),
  name: z.string(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
  age: z.number().optional(),
  quota: z.number(),
});

// Login with email OR username
export const LoginInputSchema = z.object({
  identifier: z.string().min(1, 'El identificador es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

// Registration: role is NOT user-controllable
export const RegisterInputSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos').optional(),
  age: z.number().int().positive().optional(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

// ==================== Types ====================

export type User = z.infer<typeof UserSchema>;
export type Role = z.infer<typeof UserSchema>['role'];
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
