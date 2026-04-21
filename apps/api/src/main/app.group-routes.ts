import type { Express } from 'express';

import { GroupService } from '@/features/group/application/services/group.service.js';
import { ContentAccessService } from '@/features/group/application/services/content-access.service.js';
import {
  PrismaGroupRepository,
  PrismaGroupMemberRepository,
  PrismaGroupClassRepository,
} from '@/features/group/infrastructure/persistence/prisma-group.repository.js';
import { createGroupRoutes } from '@/features/group/infrastructure/http/group.routes.js';
import { createContentAccessRoutes } from '@/features/group/infrastructure/http/content-access.routes.js';

let _contentAccessService: ContentAccessService;

export function getContentAccessService(): ContentAccessService {
  return _contentAccessService;
}

export function setupGroupRoutes(
  app: Express,
  protectedMiddleware: (req: any, res: any, next: any) => void,
  requireRole: (...roles: string[]) => any,
): void {
  const groupRepo = new PrismaGroupRepository();
  const memberRepo = new PrismaGroupMemberRepository();
  const classRepo = new PrismaGroupClassRepository();
  const groupService = new GroupService(groupRepo, memberRepo, classRepo);
  const contentAccessService = new ContentAccessService(memberRepo, classRepo);
  _contentAccessService = contentAccessService;

  const groupMiddleware = [protectedMiddleware, requireRole('TEACHER', 'ADMIN')] as const;

  app.use('/api/groups', ...groupMiddleware, createGroupRoutes(groupService));
  app.use(
    '/api/content/accessible',
    protectedMiddleware,
    createContentAccessRoutes(contentAccessService),
  );
}
