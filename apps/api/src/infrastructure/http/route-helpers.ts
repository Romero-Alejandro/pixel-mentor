/**
 * Route Handler Helper
 *
 * Provides a wrapper for Express route handlers that automatically
 * handles errors using the centralized error mapper.
 */

import type { Request, Response, NextFunction } from 'express';

import { sendErrorResponse } from '@/infrastructure/http/error-mapper.js';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async route handler to automatically catch and handle errors
 *
 * @example
 * ```typescript
 * router.get('/items', asyncHandler(async (req, res) => {
 *   const items = await itemService.findAll();
 *   res.json(items);
 * }));
 * ```
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      sendErrorResponse(res, error);
    });
  };
}

/**
 * Creates a success response with consistent structure
 */
export function sendSuccessResponse<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(data);
}

/**
 * Creates a paginated response
 */
export function sendPaginatedResponse<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  res.status(200).json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
