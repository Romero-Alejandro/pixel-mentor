import { z } from 'zod';

// ==================== Get Session Input ====================

export const GetSessionInputSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
});

export type GetSessionInput = z.infer<typeof GetSessionInputSchema>;

// ==================== List Sessions Input ====================

export const ListSessionsInputSchema = z.object({
  studentId: z
    .string()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
    .optional(),
  activeOnly: z.boolean().optional().default(false),
});

export type ListSessionsInput = z.infer<typeof ListSessionsInputSchema>;
