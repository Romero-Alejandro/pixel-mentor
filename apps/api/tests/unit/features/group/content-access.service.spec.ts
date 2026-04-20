import { prisma } from '@/database/client.js';
import { ContentAccessService } from '@/features/group/application/services/content-access.service.js';

jest.mock('@/database/client.js', () => ({
  prisma: {
    groupClass: { findMany: jest.fn() },
    class: { findUnique: jest.fn() },
    groupMember: { findMany: jest.fn(), findFirst: jest.fn() },
  },
}));

describe('ContentAccessService', () => {
  let service: ContentAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentAccessService();
  });

  describe('getAccessibleContentForUser', () => {
    it('should return all content for admin', async () => {
      (prisma.groupClass.findMany as jest.Mock).mockResolvedValue([
        {
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
          group: { id: 'group-1', name: 'Group 1', teacher: { name: 'Teacher 1' } },
          order: 0,
        },
      ]);

      const result = await service.getAccessibleContentForUser('admin-1', 'ADMIN');

      expect(result).toHaveLength(1);
      expect(result[0].classId).toBe('class-1');
      expect(result[0].classTitle).toBe('Class 1');
    });

    it('should return content for teacher owned groups', async () => {
      (prisma.groupClass.findMany as jest.Mock).mockResolvedValue([
        {
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
          group: { id: 'group-1', name: 'My Group' },
          order: 0,
        },
      ]);

      const result = await service.getAccessibleContentForUser('teacher-1', 'TEACHER');

      expect(result).toHaveLength(1);
      expect(result[0].groupName).toBe('My Group');
    });

    it('should return content for student in active groups', async () => {
      (prisma.groupMember.findMany as jest.Mock).mockResolvedValue([{ groupId: 'group-1' }]);
      (prisma.groupClass.findMany as jest.Mock).mockResolvedValue([
        {
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
          group: { id: 'group-1', name: 'Student Group' },
          order: 0,
        },
      ]);

      const result = await service.getAccessibleContentForUser('student-1', 'STUDENT');

      expect(result).toHaveLength(1);
      expect(result[0].classTitle).toBe('Class 1');
    });

    it('should return empty array for student with no groups', async () => {
      (prisma.groupMember.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAccessibleContentForUser('student-1', 'STUDENT');

      expect(result).toHaveLength(0);
    });
  });

  describe('canAccessClass', () => {
    it('should return true for admin', async () => {
      const result = await service.canAccessClass('admin-1', 'ADMIN', 'class-1');

      expect(result).toBe(true);
    });

    it('should return true for class owner teacher', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue({
        id: 'class-1',
        tutorId: 'teacher-1',
      });

      const result = await service.canAccessClass('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(true);
    });

    it('should return false for non-owner teacher', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue({
        id: 'class-1',
        tutorId: 'other-teacher',
      });

      const result = await service.canAccessClass('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(false);
    });

    it('should return true for student in group with class', async () => {
      (prisma.groupMember.findFirst as jest.Mock).mockResolvedValue({ id: 'member-1' });

      const result = await service.canAccessClass('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(true);
    });

    it('should return false for student not in group', async () => {
      (prisma.groupMember.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.canAccessClass('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(false);
    });

    it('should return false for student in inactive group', async () => {
      (prisma.groupMember.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.canAccessClass('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(false);
    });
  });
});
