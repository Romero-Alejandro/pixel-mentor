/**
 * Domain Validation Module
 *
 * Provides validation utilities for domain entities and state transitions.
 * Uses Zod schemas for type-safe validation at the domain layer.
 */

import { z } from 'zod';
import { createLogger, type LogLevel } from '@/shared/logger/logger.js';

import { AppError, ErrorCodes } from '@/shared/errors/index.js';

const logger = createLogger(undefined, { level: (process.env.LOG_LEVEL as LogLevel) || 'warn' });

// ==================== Common Validation Schemas ====================

/**
 * UUID v4 validation schema
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * Non-empty string schema
 */
export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

/**
 * Positive integer schema
 */
export const PositiveIntSchema = z.number().int().positive('Must be a positive integer');

/**
 * Non-negative integer schema
 */
export const NonNegativeIntSchema = z.number().int().min(0, 'Must be a non-negative integer');

/**
 * Date schema (accepts Date objects or ISO strings)
 */
export const DateSchema = z.union([z.date(), z.string().datetime()]);

// ==================== Pedagogical State Schema ====================

export const PedagogicalStateSchema = z.enum([
  'AWAITING_START',
  'ACTIVE_CLASS',
  'RESOLVING_DOUBT',
  'CLARIFYING',
  'EXPLANATION',
  'ACTIVITY_WAIT',
  'ACTIVITY_INACTIVITY_WARNING',
  'ACTIVITY_SKIP_OFFER',
  'QUESTION',
  'EVALUATION',
  'COMPLETED',
]);

// ==================== Session Validation ====================

export const SessionStatusSchema = z.enum([
  'IDLE',
  'ACTIVE',
  'PAUSED_FOR_QUESTION',
  'AWAITING_CONFIRMATION',
  'PAUSED_IDLE',
  'COMPLETED',
  'ESCALATED',
]);

export type ValidatedSessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Doubt context schema
 */
export const DoubtContextSchema = z.object({
  question: z.string(),
  stepIndex: z.number().int().min(0),
});

/**
 * Session checkpoint schema with full validation
 */
export const SessionCheckpointSchema = z.object({
  currentState: PedagogicalStateSchema.default('ACTIVE_CLASS'),
  currentStepIndex: z.number().int().min(0).default(0),
  savedStepIndex: z.number().int().min(0).optional(),
  doubtContext: DoubtContextSchema.optional(),
  questionCount: z.number().int().min(0).default(0),
  lastQuestionTime: z.string().nullable().default(null),
  skippedActivities: z.array(z.string()).default([]),
  failedAttempts: z.number().int().min(0).default(0),
  totalWrongAnswers: z.number().int().min(0).default(0),
});

export type ValidatedSessionCheckpoint = z.infer<typeof SessionCheckpointSchema>;

/**
 * Normalizes and validates a checkpoint from raw database data
 * Provides safe defaults for missing or invalid fields
 */
export function normalizeCheckpoint(
  raw: Record<string, unknown> | null | undefined,
): ValidatedSessionCheckpoint {
  const result = SessionCheckpointSchema.safeParse(raw ?? {});

  if (!result.success) {
    // Log warning but don't throw - provide safe defaults
    logger.warn({ issues: result.error.issues }, 'Invalid checkpoint data, using defaults');
    return SessionCheckpointSchema.parse({});
  }

  return result.data;
}

// ==================== Session Transitions ====================

/**
 * Valid session status transitions
 */
export const SESSION_TRANSITIONS: Record<ValidatedSessionStatus, ValidatedSessionStatus[]> = {
  IDLE: ['ACTIVE'],
  ACTIVE: ['PAUSED_FOR_QUESTION', 'PAUSED_IDLE', 'COMPLETED', 'ESCALATED'],
  PAUSED_FOR_QUESTION: ['AWAITING_CONFIRMATION', 'ACTIVE', 'ESCALATED'],
  AWAITING_CONFIRMATION: ['ACTIVE', 'COMPLETED', 'ESCALATED'],
  PAUSED_IDLE: ['ACTIVE', 'COMPLETED'],
  COMPLETED: [], // Terminal state
  ESCALATED: [], // Terminal state
};

/**
 * Validates if a session status transition is allowed
 */
export function validateSessionTransition(
  currentStatus: ValidatedSessionStatus,
  nextStatus: ValidatedSessionStatus,
): void {
  const validTransitions = SESSION_TRANSITIONS[currentStatus];

  if (!validTransitions.includes(nextStatus)) {
    throw new AppError(
      ErrorCodes.CLASS_STATE_ERROR,
      409,
      `Invalid session transition: ${currentStatus} -> ${nextStatus}`,
      { currentStatus, nextStatus, validTransitions },
    );
  }
}

// ==================== Class Validation ====================

export const ClassStatusSchema = z.enum(['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED']);

export type ValidatedClassStatus = z.infer<typeof ClassStatusSchema>;

/**
 * Valid class status transitions
 */
export const CLASS_TRANSITIONS: Record<ValidatedClassStatus, ValidatedClassStatus[]> = {
  DRAFT: ['UNDER_REVIEW', 'PUBLISHED'],
  UNDER_REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['PUBLISHED'],
};

/**
 * Validates if a class status transition is allowed
 */
export function validateClassTransition(
  currentStatus: ValidatedClassStatus,
  nextStatus: ValidatedClassStatus,
): void {
  const validTransitions = CLASS_TRANSITIONS[currentStatus];

  if (!validTransitions.includes(nextStatus)) {
    throw new AppError(
      ErrorCodes.CLASS_STATE_ERROR,
      409,
      `Invalid class transition: ${currentStatus} -> ${nextStatus}`,
      { currentStatus, nextStatus, validTransitions },
    );
  }
}

// ==================== Recipe Validation ====================

export const StepTypeSchema = z.enum(['content', 'activity', 'question', 'intro', 'closure']);

export const RecipeStepSchema = z.object({
  id: UUIDSchema,
  recipeId: UUIDSchema,
  order: NonNegativeIntSchema,
  stepType: StepTypeSchema,
  conceptId: UUIDSchema.optional(),
  activityId: UUIDSchema.optional(),
});

/**
 * Validates that recipe steps have valid ordering
 */
export function validateRecipeStepsOrder(steps: { order: number }[]): void {
  const orders = steps.map((s) => s.order);
  const uniqueOrders = new Set(orders);

  if (uniqueOrders.size !== orders.length) {
    throw new AppError(
      ErrorCodes.RECIPE_VALIDATION_ERROR,
      400,
      'Recipe steps have duplicate order values',
      { orders },
    );
  }

  // Check for gaps (optional - depends on business rules)
  const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length; i++) {
    if (sortedOrders[i] !== i) {
      // This might be acceptable depending on business rules
      // For now, just log a warning
      logger.warn(`Recipe steps have gaps in ordering: expected ${i}, got ${sortedOrders[i]}`);
    }
  }
}

// ==================== Generic Validation Helpers ====================

/**
 * Validates data against a Zod schema and throws AppError on failure
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorCode: string = ErrorCodes.VALIDATION_ERROR,
  errorMessage: string = 'Validation failed',
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }

    throw new AppError(errorCode, 400, errorMessage, { fieldErrors });
  }

  return result.data;
}

/**
 * Validates that a value is not null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  errorMessage: string = 'Value is required',
): T {
  if (value === null || value === undefined) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, errorMessage);
  }
  return value;
}

/**
 * Validates that a string is a valid UUID
 */
export function assertValidUUID(value: string, fieldName: string = 'id'): void {
  const result = UUIDSchema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      400,
      `Invalid ${fieldName}: must be a valid UUID`,
      { value, field: fieldName },
    );
  }
}
