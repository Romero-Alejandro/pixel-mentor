import { prisma } from '@/database/client.js';

import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';

const ROLE_TEACHER: UserRole = 'TEACHER';
const ROLE_ADMIN: UserRole = 'ADMIN';

export interface ContentAccessResult {
  classId: string;
  classTitle: string;
  groupId: string;
  groupName: string;
  order: number;
  status: string;
}

export class ContentAccessError extends Error {
  readonly code = 'CONTENT_ACCESS_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ContentAccessError';
  }
}

export class ContentAccessService {
  async getAccessibleContentForUser(
    userId: string,
    userRole: UserRole,
  ): Promise<ContentAccessResult[]> {
    if (userRole === ROLE_ADMIN) {
      return this.getAllAccessibleContent();
    }

    if (userRole === ROLE_TEACHER) {
      return this.getContentForTeacher(userId);
    }

    return this.getContentForStudent(userId);
  }

  private async getAllAccessibleContent(): Promise<ContentAccessResult[]> {
    const groupClasses = await prisma.groupClass.findMany({
      where: {
        class: {
          status: { in: ['PUBLISHED', 'UNDER_REVIEW'] },
        },
      },
      include: {
        group: {
          include: {
            teacher: {
              select: { name: true },
            },
          },
        },
        class: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return groupClasses.map((gc) => ({
      classId: gc.class.id,
      classTitle: gc.class.title,
      groupId: gc.group.id,
      groupName: gc.group.name,
      order: gc.order,
      status: gc.class.status,
    }));
  }

  private async getContentForTeacher(teacherId: string): Promise<ContentAccessResult[]> {
    const groupClasses = await prisma.groupClass.findMany({
      where: {
        group: { teacherId },
        class: {
          status: { in: ['PUBLISHED', 'UNDER_REVIEW'] },
        },
      },
      include: {
        group: {
          select: { id: true, name: true },
        },
        class: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return groupClasses.map((gc) => ({
      classId: gc.class.id,
      classTitle: gc.class.title,
      groupId: gc.group.id,
      groupName: gc.group.name,
      order: gc.order,
      status: gc.class.status,
    }));
  }

  private async getContentForStudent(studentId: string): Promise<ContentAccessResult[]> {
    const memberships = await prisma.groupMember.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
      },
      select: { groupId: true },
    });

    if (memberships.length === 0) {
      return [];
    }

    const groupIds = memberships.map((m) => m.groupId);

    const groupClasses = await prisma.groupClass.findMany({
      where: {
        groupId: { in: groupIds },
        class: {
          status: { in: ['PUBLISHED', 'UNDER_REVIEW'] },
        },
      },
      include: {
        group: {
          select: { id: true, name: true },
        },
        class: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: [{ groupId: 'asc' }, { order: 'asc' }],
    });

    return groupClasses.map((gc) => ({
      classId: gc.class.id,
      classTitle: gc.class.title,
      groupId: gc.group.id,
      groupName: gc.group.name,
      order: gc.order,
      status: gc.class.status,
    }));
  }

  async canAccessClass(userId: string, userRole: UserRole, classId: string): Promise<boolean> {
    if (userRole === ROLE_ADMIN) {
      return true;
    }

    if (userRole === ROLE_TEACHER) {
      const classEntity = await prisma.class.findUnique({
        where: { id: classId },
        select: { tutorId: true },
      });
      return classEntity?.tutorId === userId;
    }

    const membership = await prisma.groupMember.findFirst({
      where: {
        studentId: userId,
        status: 'ACTIVE',
        group: {
          classAssignments: {
            some: { classId: classId },
          },
        },
      },
      select: { id: true },
    });

    return membership !== null;
  }
}
