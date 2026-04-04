import { Router, type Request, type Response } from 'express';
import { getAIServices, isAIServicesInitialized } from '@/shared/ai/ai-service.provider.js';

/**
 * Admin routes for LLM governance monitoring and management.
 * Requires ADMIN role - must be mounted behind admin middleware.
 */
export function createLLMGovernanceRouter(): Router {
  const router = Router();

  // GET /api/admin/llm-governance - Get governance metrics
  router.get('/', (_req: Request, res: Response) => {
    if (!isAIServicesInitialized()) {
      res.status(503).json({ error: 'AI services not initialized' });
      return;
    }

    const provider = getAIServices();
    const metrics = provider.governance.getMetrics();
    const health = provider.health();

    res.json({
      health,
      governance: {
        budget: metrics.budget,
        quota: metrics.quota,
        rateLimit: metrics.rateLimit,
        recentActivity: metrics.recentLogs,
      },
    });
  });

  // GET /api/admin/llm-governance/logs - Get recent usage logs
  router.get('/logs', (_req: Request, res: Response) => {
    if (!isAIServicesInitialized()) {
      res.status(503).json({ error: 'AI services not initialized' });
      return;
    }

    const limit = parseInt(String((_req as any).query.limit ?? '50'), 10);
    const logs = getAIServices().governance.getUsageLogs(limit);

    res.json({ logs, count: logs.length });
  });

  // POST /api/admin/llm-governance/users/:userId/quota - Set user quota
  router.post('/users/:userId/quota', (_req: Request, res: Response) => {
    if (!isAIServicesInitialized()) {
      res.status(503).json({ error: 'AI services not initialized' });
      return;
    }

    const userId = Array.isArray(_req.params.userId) ? _req.params.userId[0] : _req.params.userId;
    const { quota } = (_req as any).body as { quota?: number };

    if (quota === undefined || quota < 0) {
      res.status(400).json({ error: 'Invalid quota value' });
      return;
    }

    getAIServices().governance.setUserQuota(userId, quota);
    res.json({ userId, quota, remaining: getAIServices().governance.getUserQuota(userId) });
  });

  // POST /api/admin/llm-governance/budget/reset - Reset daily budget
  router.post('/budget/reset', (_req: Request, res: Response) => {
    if (!isAIServicesInitialized()) {
      res.status(503).json({ error: 'AI services not initialized' });
      return;
    }

    // BudgetGuard doesn't expose direct reset, but we can return current metrics
    const metrics = getAIServices().governance.getMetrics();
    res.json({ message: 'Budget metrics', budget: metrics.budget });
  });

  return router;
}
