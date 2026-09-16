import { Router, type Request, type Response } from 'express';

import type { ContentAccessService } from '@/features/group/application/services/content-access.service.js';
import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';
import { moduleLogger } from '@/shared/logger/logger.js';

const logger = moduleLogger('content-access:routes');

interface AuthUser {
  id: string;
  role: string;
}

function getUserFromRequest(req: Request): AuthUser | null {
  return (req as Request & { user?: AuthUser }).user ?? null;
}

const USER_ROLES: readonly UserRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];

/** Boundary guard for the JWT role string; unknown values fall back to STUDENT. */
function toUserRole(role: string): UserRole {
  const roleMatch = USER_ROLES.find((candidate) => candidate === role);
  return roleMatch ?? 'STUDENT';
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
        toUserRole(user.role),
      );
      res.json(content);
    } catch (error) {
      logger.error({ err: error }, 'Get accessible content failed');
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
        toUserRole(user.role),
        String(req.params.classId),
      );

      res.json({ canAccess });
    } catch (error) {
      logger.error({ err: error }, 'Check content access failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
