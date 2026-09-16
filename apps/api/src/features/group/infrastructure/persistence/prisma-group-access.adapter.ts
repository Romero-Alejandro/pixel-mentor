import { prisma } from '@/database/client.js';
import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';
import type {
  IGroupAccessPort,
  GroupContentView,
} from '@/features/group/domain/ports/group-access.port.js';

const PUBLISHED_STATUSES = ['PUBLISHED', 'UNDER_REVIEW'] as const;

function toContentView(gc: {
  order: number;
  group: { id: string; name: string };
  class: { id: string; title: string; status: string };
}): GroupContentView {
  return {
    classId: gc.class.id,
    classTitle: gc.class.title,
    groupId: gc.group.id,
    groupName: gc.group.name,
    order: gc.order,
    status: gc.class.status,
  };
}

/**
 * Prisma adapter for the group feature's access-view port.
 * Translates prisma rows into plain GroupContentView projections.
 */
export class PrismaGroupAccessAdapter implements IGroupAccessPort {
  async findAllPublished(): Promise<GroupContentView[]> {
    const groupClasses = await prisma.groupClass.findMany({
      where: {
        class: {
          status: { in: [...PUBLISHED_STATUSES] },
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

    return groupClasses.map(toContentView);
  }

  async findByTeacher(teacherId: string): Promise<GroupContentView[]> {
    const groupClasses = await prisma.groupClass.findMany({
      where: {
        group: { teacherId },
        class: {
          status: { in: [...PUBLISHED_STATUSES] },
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

    return groupClasses.map(toContentView);
  }

  async findByStudent(studentId: string): Promise<GroupContentView[]> {
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
          status: { in: [...PUBLISHED_STATUSES] },
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

    return groupClasses.map(toContentView);
  }

  async canAccess(userId: string, userRole: UserRole, classId: string): Promise<boolean> {
    if (userRole === 'ADMIN') {
      return true;
    }

    if (userRole === 'TEACHER') {
      const classEntity = await prisma.class.findUnique({
        where: { id: classId },
        select: { tutorId: true },
      });
      return classEntity?.tutorId === userId;
    }

    // Students can only access classes actually visible to them: the
    // assignment must exist AND the class must be PUBLISHED/UNDER_REVIEW.
    // Enrollment alone must not leak DRAFT/ARCHIVED content.
    const membership = await prisma.groupMember.findFirst({
      where: {
        studentId: userId,
        status: 'ACTIVE',
        group: {
          classAssignments: {
            some: {
              classId,
              class: { status: { in: [...PUBLISHED_STATUSES] } },
            },
          },
        },
      },
      select: { id: true },
    });

    return membership !== null;
  }
}
