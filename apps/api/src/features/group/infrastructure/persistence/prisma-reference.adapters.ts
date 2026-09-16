import { prisma } from '@/database/client.js';
import type {
  IStudentLookupPort,
  IClassReferencePort,
} from '@/features/group/domain/ports/student-lookup.port.js';

/**
 * Prisma adapter: verifies which of the given ids exist as STUDENT-role users.
 */
export class PrismaStudentLookupAdapter implements IStudentLookupPort {
  async findExistingStudentIds(ids: string[]): Promise<string[]> {
    const students = await prisma.user.findMany({
      where: { id: { in: ids }, role: 'STUDENT' },
      select: { id: true },
    });
    return students.map((s) => s.id);
  }
}

/**
 * Prisma adapter: resolves a class's owner without leaking class persistence.
 */
export class PrismaClassReferenceAdapter implements IClassReferencePort {
  async findOwnerById(classId: string): Promise<{ tutorId: string } | null> {
    const classEntity = await prisma.class.findUnique({
      where: { id: classId },
      select: { tutorId: true },
    });
    return classEntity ?? null;
  }
}
