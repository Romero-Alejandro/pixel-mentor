import { Router, type Request, type Response } from 'express';

import type { ContentAccessService } from '../../application/services/content-access.service.js';

interface AuthUser {
  id: string;
  role: string;
}

function getUserFromRequest(req: Request): AuthUser | null {
  return (req as any).user ?? null;
}

export function createContentAccessRoutes(contentAccessService: ContentAccessService): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const content = await contentAccessService.getAccessibleContentForUser(
        user.id,
        user.role as any,
      );
      res.json(content);
    } catch (error) {
      console.error('Get accessible content error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/can-access/:classId', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const canAccess = await contentAccessService.canAccessClass(
        user.id,
        user.role as any,
        String(req.params.classId),
      );

      res.json({ canAccess });
    } catch (error) {
      console.error('Check content access error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
