import { PrismaGroupAccessAdapter } from '@/features/group/infrastructure/persistence/prisma-group-access.adapter.js';
import { prisma } from '@/database/client.js';

jest.mock('@/database/client.js', () => ({
  prisma: {
    groupClass: { findMany: jest.fn() },
    class: { findUnique: jest.fn() },
    groupMember: { findMany: jest.fn(), findFirst: jest.fn() },
  },
}));

describe('PrismaGroupAccessAdapter', () => {
  let adapter: PrismaGroupAccessAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PrismaGroupAccessAdapter();
  });

  describe('findAllPublished', () => {
    it('should map rows to content views', async () => {
      (prisma.groupClass.findMany as jest.Mock).mockResolvedValue([
        {
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
          group: { id: 'group-1', name: 'Group 1', teacher: { name: 'Teacher 1' } },
          order: 0,
        },
      ]);

      const result = await adapter.findAllPublished();

      expect(result).toEqual([
        {
          classId: 'class-1',
          classTitle: 'Class 1',
          groupId: 'group-1',
          groupName: 'Group 1',
          order: 0,
          status: 'PUBLISHED',
        },
      ]);
    });
  });

  describe('findByTeacher', () => {
    it('should map teacher rows to content views', async () => {
      (prisma.groupClass.findMany as jest.Mock).mockResolvedValue([
        {
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
          group: { id: 'group-1', name: 'My Group' },
          order: 0,
        },
      ]);

      const result = await adapter.findByTeacher('teacher-1');

      expect(prisma.groupClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ group: { teacherId: 'teacher-1' } }),
        }),
      );
      expect(result[0].groupName).toBe('My Group');
    });
  });

  describe('findByStudent', () => {
    it('should return empty for student with no memberships', async () => {
      (prisma.groupMember.findMany as jest.Mock).mockResolvedValue([]);

      const result = await adapter.findByStudent('student-1');

      expect(result).toEqual([]);
      expect(prisma.groupClass.findMany).not.toHaveBeenCalled();
    });

    it('should query assignments for the student active groups', async () => {
      (prisma.groupMember.findMany as jest.Mock).mockResolvedValue([{ groupId: 'group-1' }]);
      (prisma.groupClass.findMany as jest.Mock).mockResolvedValue([
        {
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
          group: { id: 'group-1', name: 'Student Group' },
          order: 0,
        },
      ]);

      const result = await adapter.findByStudent('student-1');

      expect(prisma.groupClass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ groupId: { in: ['group-1'] } }),
        }),
      );
      expect(result[0].groupName).toBe('Student Group');
    });
  });

  describe('canAccess', () => {
    it('should return true for admin without querying', async () => {
      const result = await adapter.canAccess('admin-1', 'ADMIN', 'class-1');

      expect(result).toBe(true);
      expect(prisma.class.findUnique).not.toHaveBeenCalled();
    });

    it('should return true when teacher owns the class', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue({ tutorId: 'teacher-1' });

      const result = await adapter.canAccess('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(true);
    });

    it('should return false for non-owner teacher', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue({ tutorId: 'other-teacher' });

      const result = await adapter.canAccess('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(false);
    });

    it('should return false when teacher class missing', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await adapter.canAccess('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(false);
    });

    it('should return true for student with active membership', async () => {
      (prisma.groupMember.findFirst as jest.Mock).mockResolvedValue({ id: 'member-1' });

      const result = await adapter.canAccess('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(true);
    });

    it('should return false for student without membership', async () => {
      (prisma.groupMember.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await adapter.canAccess('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(false);
    });

    it('should filter student access to PUBLISHED/UNDER_REVIEW classes only', async () => {
      (prisma.groupMember.findFirst as jest.Mock).mockResolvedValue(null);

      await adapter.canAccess('student-1', 'STUDENT', 'class-1');

      expect(prisma.groupMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            group: expect.objectContaining({
              classAssignments: expect.objectContaining({
                some: expect.objectContaining({
                  class: { status: { in: ['PUBLISHED', 'UNDER_REVIEW'] } },
                }),
              }),
            }),
          }),
        }),
      );
    });
  });
});
