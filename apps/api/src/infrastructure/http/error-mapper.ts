/**
 * Error Mapper - Converts domain errors to HTTP responses
 *
 * Provides a centralized way to handle all application errors
 * and convert them to consistent HTTP responses.
 */

import type { Response, Request, NextFunction } from 'express';
import type { ZodError } from 'zod';

import { AppError, ErrorCodes } from '@/domain/errors/app-error.js';

// ==================== Response Types ====================

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export interface ValidationErrorResponse extends ErrorResponse {
  fieldErrors?: Record<string, string[]>;
}

// ==================== Error Mapper ====================

/**
 * Maps an error to an HTTP response and sends it
 */
export function sendErrorResponse(res: Response, error: unknown): void {
  // Handle Zod validation errors
  if (isZodError(error)) {
    const fieldErrors = extractZodErrors(error);
    res.status(400).json({
      error: 'Validation error',
      code: ErrorCodes.VALIDATION_ERROR,
      fieldErrors,
    });
    return;
  }

  // Handle AppError (our standardized errors)
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
    };
    if (error.details) {
      response.details = error.details;
    }
    res.status(error.httpStatus).json(response);
    return;
  }

  // Handle standard Error
  if (error instanceof Error) {
    console.error('Unhandled error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: ErrorCodes.INTERNAL_ERROR,
    });
    return;
  }

  // Handle unknown errors
  console.error('Unknown error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: ErrorCodes.INTERNAL_ERROR,
  });
}

/**
 * Maps an error to an ErrorResponse object without sending
 */
export function mapErrorToResponse(error: unknown): ErrorResponse {
  if (isZodError(error)) {
    return {
      error: 'Validation error',
      code: ErrorCodes.VALIDATION_ERROR,
      details: extractZodErrors(error),
    };
  }

  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
    };
    if (error.details) {
      response.details = error.details;
    }
    return response;
  }

  if (error instanceof Error) {
    return {
      error: 'Internal server error',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }

  return {
    error: 'Internal server error',
    code: ErrorCodes.INTERNAL_ERROR,
  };
}

/**
 * Get HTTP status code from an error
 */
export function getHttpStatus(error: unknown): number {
  if (error instanceof AppError) {
    return error.httpStatus;
  }

  if (isZodError(error)) {
    return 400;
  }

  return 500;
}

// ==================== Helpers ====================

function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError'
  );
}

function extractZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return fieldErrors;
}

// ==================== Express Error Handler Middleware ====================

/**
 * Express error handler middleware
 * Use as the last middleware in your app
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  sendErrorResponse(res, err);
}
