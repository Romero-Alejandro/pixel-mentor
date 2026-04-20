import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { GroupService } from '../../application/services/group.service.js';
import {
  GroupNotFoundError,
  GroupOwnershipError,
  StudentNotFoundError,
  ClassNotFoundError,
  GroupValidationError,
} from '../../application/services/group.service.js';

const ROLE_TEACHER = 'TEACHER';
const ROLE_ADMIN = 'ADMIN';

interface AuthUser {
  id: string;
  role: string;
}

function getUserFromRequest(req: Request): AuthUser | null {
  return (req as any).user ?? null;
}

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  description: z.string().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const addMembersSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student is required'),
});

const assignClassSchema = z.object({
  classId: z.string().uuid(),
  order: z.number().int().min(0).optional(),
});

const reorderClassesSchema = z.object({
  classIds: z.array(z.string().uuid()).min(1),
});

function isTeacherOrAdmin(role: string): boolean {
  return role === ROLE_TEACHER || role === ROLE_ADMIN;
}

function getFirstErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  return firstIssue ? firstIssue.message : 'Validation error';
}

export function createGroupRoutes(groupService: GroupService): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can create groups' });
        return;
      }

      const parsed = createGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getFirstErrorMessage(parsed.error) });
        return;
      }

      const group = await groupService.createGroup(user.id, parsed.data);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof GroupValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can list groups' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await groupService.getGroupsByTeacher(user.id, { page, limit });
      res.json(result);
    } catch (error) {
      console.error('Get groups error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:groupId', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const group = await groupService.getGroup(String(req.params.groupId));

      if (user.role === 'STUDENT') {
        const { prisma } = await import('@/database/client.js');
        const membership = await prisma.groupMember.findUnique({
          where: {
            groupId_studentId: { groupId: group.id, studentId: user.id },
          },
        });
        if (!membership || membership.status !== 'ACTIVE') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      } else if (group.teacherId !== user.id && user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json(group);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error('Get group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/:groupId', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can update groups' });
        return;
      }

      const parsed = updateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getFirstErrorMessage(parsed.error) });
        return;
      }

      const group = await groupService.updateGroup(
        String(req.params.groupId),
        user.id,
        parsed.data,
      );
      res.json(group);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Update group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:groupId', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can delete groups' });
        return;
      }

      await groupService.deleteGroup(String(req.params.groupId), user.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Delete group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:groupId/members', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can add members' });
        return;
      }

      const parsed = addMembersSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getFirstErrorMessage(parsed.error) });
        return;
      }

      const members = await groupService.addMembers(
        String(req.params.groupId),
        user.id,
        parsed.data,
      );
      res.status(201).json(members);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof StudentNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error('Add members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:groupId/members', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const members = await groupService.getMembers(String(req.params.groupId), user.id);
      res.json(members);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:groupId/members/:studentId', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can remove members' });
        return;
      }

      await groupService.removeMember(
        String(req.params.groupId),
        user.id,
        String(req.params.studentId),
      );
      res.status(204).send();
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/:groupId/classes', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can assign classes' });
        return;
      }

      const parsed = assignClassSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getFirstErrorMessage(parsed.error) });
        return;
      }

      const groupClass = await groupService.assignClass(
        String(req.params.groupId),
        user.id,
        parsed.data,
      );
      res.status(201).json(groupClass);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('Assign class error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:groupId/classes', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const classes = await groupService.getGroupClasses(
        String(req.params.groupId),
        user.id,
        user.role as 'TEACHER' | 'STUDENT' | 'ADMIN',
      );
      res.json(classes);
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof GroupValidationError) {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Get classes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:groupId/classes/:classId', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can unassign classes' });
        return;
      }

      await groupService.unassignClass(
        String(req.params.groupId),
        user.id,
        String(req.params.classId),
      );
      res.status(204).send();
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      console.error('Unassign class error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:groupId/classes/reorder', async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!isTeacherOrAdmin(user.role)) {
        res.status(403).json({ error: 'Only teachers can reorder classes' });
        return;
      }

      const parsed = reorderClassesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: getFirstErrorMessage(parsed.error) });
        return;
      }

      await groupService.reorderClasses(String(req.params.groupId), user.id, parsed.data);
      res.status(204).send();
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof GroupOwnershipError) {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof ClassNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error('Reorder classes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
