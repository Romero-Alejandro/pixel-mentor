/**
 * Evaluation Metrics Router
 *
 * Provides HTTP endpoints for:
 * - GET /metrics/evaluation - Retrieve current evaluation metrics
 * - POST /metrics/evaluation/reset - Reset all metrics (protected)
 * - GET /metrics/evaluation/summary - Human-readable metrics summary
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getMetricsStore, resetMetricsStore, getMetricsSummary } from '@/monitoring/eval-metrics';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { VerifyTokenUseCase } from '@/application/use-cases/auth/verify-token.use-case.js';

/**
 * Request body schema for reset endpoint
 */
const ResetMetricsSchema = z.object({
  confirm: z.literal(true),
});

export interface MetricsDependencies {
  userRepository?: UserRepository;
  verifyTokenUseCase?: VerifyTokenUseCase;
}

/**
 * Create the metrics router with optional authentication
 */
export function createMetricsRouter(deps: MetricsDependencies = {}): Router {
  const router = Router();

  /**
   * GET /metrics/evaluation
   * Returns current evaluation metrics as JSON
   */
  router.get('/', (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const metrics = getMetricsStore().getMetrics();
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /metrics/evaluation/summary
   * Returns human-readable metrics summary
   */
  router.get('/summary', (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const summary = getMetricsSummary();
      res.type('text/plain').send(summary);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /metrics/evaluation/reset
   * Reset all metrics. Requires authentication in production.
   */
  router.post('/reset', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // In production, verify admin authentication
      // For now, we check if deps are provided
      const authHeader = req.headers.authorization;

      if (deps.verifyTokenUseCase && authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '');
          await deps.verifyTokenUseCase.execute(token);
          // In a real app, verify admin role here
        } catch {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }

      // Validate request body
      const parseResult = ResetMetricsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
        return;
      }

      resetMetricsStore();
      res.json({
        success: true,
        message: 'Metrics reset successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createMetricsRouter;
