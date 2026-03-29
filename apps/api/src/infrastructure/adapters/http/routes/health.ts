/**
 * Health Check Routes
 *
 * Provides endpoints for monitoring and load balancers:
 * - GET /health - Full health check with dependency status
 * - GET /health/live - Liveness probe (always returns 200 if process is running)
 * - GET /health/ready - Readiness probe (returns 200 only if all deps are healthy)
 */

import { Router, type Response } from 'express';
import { getHealthCheckService, type HealthStatus } from '@/infrastructure/observability/index.js';

const router = Router();

/**
 * GET /health - Full health check
 * Returns detailed status of all dependencies
 */
router.get('/', async (_req: any, res: Response): Promise<void> => {
  const healthCheck = getHealthCheckService();
  const result = await healthCheck.check();

  const statusCode: Record<HealthStatus, number> = {
    healthy: 200,
    degraded: 200, // Still operational
    unhealthy: 503,
  };

  res.status(statusCode[result.status]).json(result);
});

/**
 * GET /health/live - Liveness probe
 * Always returns 200 if the process is running
 * Used by orchestrators (K8s, ECS) to know if container should be restarted
 */
router.get('/live', (_req: any, res: Response): void => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * GET /health/ready - Readiness probe
 * Returns 200 only if critical dependencies (database) are healthy
 * Used by load balancers to know if container should receive traffic
 */
router.get('/ready', async (_req: any, res: Response): Promise<void> => {
  const healthCheck = getHealthCheckService();
  const result = await healthCheck.check();

  // Ready only if database is up (cache and circuit breakers are non-critical)
  const isReady = result.checks.database.status === 'up';

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: result.timestamp,
    checks: {
      database: result.checks.database.status,
    },
  });
});

export const healthRouter = router;
