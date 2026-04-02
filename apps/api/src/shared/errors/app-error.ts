/**
 * AppError - Base class for all application errors
 *
 * Provides a consistent error structure across the application with:
 * - `code`: Machine-readable error code for client-side handling
 * - `httpStatus`: HTTP status code for API responses
 * - `message`: Human-readable error message
 * - `details`: Optional additional error context
 *
 * @example
 * ```typescript
 * throw new AppError('VALIDATION_ERROR', 400, 'Invalid input', { field: 'email' });
 * ```
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: string, httpStatus: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to a plain object for serialization
   */
  toJSON(): ErrorJSON {
    return {
      name: this.name,
      code: this.code,
      httpStatus: this.httpStatus,
      message: this.message,
      details: this.details,
    };
  }
}

export interface ErrorJSON {
  name: string;
  code: string;
  httpStatus: number;
  message: string;
  details?: unknown;
}

// ==================== Domain Error Codes ====================

export const ErrorCodes = {
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Recipe Domain
  RECIPE_NOT_FOUND: 'RECIPE_NOT_FOUND',
  RECIPE_OWNERSHIP_ERROR: 'RECIPE_OWNERSHIP_ERROR',
  RECIPE_IN_USE: 'RECIPE_IN_USE',
  RECIPE_VALIDATION_ERROR: 'RECIPE_VALIDATION_ERROR',
  STEP_NOT_FOUND: 'STEP_NOT_FOUND',

  // Class Domain
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  CLASS_OWNERSHIP_ERROR: 'CLASS_OWNERSHIP_ERROR',
  CLASS_STATE_ERROR: 'CLASS_STATE_ERROR',
  CLASS_VALIDATION_ERROR: 'CLASS_VALIDATION_ERROR',
  LESSON_NOT_FOUND: 'LESSON_NOT_FOUND',

  // Template Domain
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_OWNERSHIP_ERROR: 'TEMPLATE_OWNERSHIP_ERROR',

  // Session Domain
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  ACTIVE_SESSION_EXISTS: 'ACTIVE_SESSION_EXISTS',

  // Generic
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
