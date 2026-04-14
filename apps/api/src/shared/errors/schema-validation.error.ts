import type { z } from 'zod';

export class SchemaValidationError extends Error {
  readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    const message = SchemaValidationError.formatMessage(zodError);
    super(message);
    this.name = 'SchemaValidationError';
    this.zodError = zodError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaValidationError);
    }
  }

  private static formatMessage(zodError: z.ZodError): string {
    const issues = zodError.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    return `Schema validation failed:\n${issues}`;
  }
}
