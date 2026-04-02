import type { z } from 'zod';

export interface ISchemaValidator<T = unknown> {
  validate(rawInput: unknown, schema: z.ZodSchema<T>): T;
}
