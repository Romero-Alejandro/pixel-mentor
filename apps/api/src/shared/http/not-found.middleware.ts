/**
 * Not Found Middleware
 *
 * Handles 404 responses for unmatched routes.
 */

import type { Response } from 'express';

import type { AppRequest } from '@/shared/types/index.js';

/**
 * Express middleware to handle unmatched routes (404)
 */
export function notFoundMiddleware(_req: AppRequest, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
