/**
 * Common Type Aliases
 *
 * Shared type definitions used across the application.
 */

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Generic result types
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// UUID type alias for clarity
export type UUID = string;

// Date string format (ISO 8601)
export type ISO8601Date = string;

// JSON response wrapper
export interface JsonResponse<T> {
  data: T;
}

export interface ErrorJsonResponse {
  error: string;
  code: string;
  details?: unknown;
}
