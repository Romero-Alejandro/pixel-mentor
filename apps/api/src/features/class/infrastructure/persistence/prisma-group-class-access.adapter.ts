import { prisma } from '@/database/client.js';
import type { IGroupClassAccessPort } from '@/features/class/domain/ports/group-class-access.port.js';

/**
 * Prisma adapter for the class feature's group-class access port.
 * Encapsulates the group-membership → class-assignment query.
 */
export class PrismaGroupClassAccessAdapter implements IGroupClassAccessPort {
  async userHasAccess(userId: string, classId: string): Promise<boolean> {
    const groupClass = await prisma.groupClass.findFirst({
      where: {
        classId,
        group: {
          memberships: {
            some: { studentId: userId, status: 'ACTIVE' },
          },
        },
      },
      select: { id: true },
    });
    return groupClass !== null;
  }

  async classExists(classId: string): Promise<boolean> {
    const classEntity = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    return classEntity !== null;
  }
}
