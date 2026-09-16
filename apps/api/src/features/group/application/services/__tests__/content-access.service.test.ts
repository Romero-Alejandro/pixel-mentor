import { ContentAccessService } from '@/features/group/application/services/content-access.service.js';
import type {
  IGroupAccessPort,
  GroupContentView,
} from '@/features/group/domain/ports/group-access.port.js';

const createFakeGroupAccess = (): jest.Mocked<IGroupAccessPort> => ({
  findAllPublished: jest.fn(),
  findByTeacher: jest.fn(),
  findByStudent: jest.fn(),
  canAccess: jest.fn(),
});

const contentView = (overrides: Partial<GroupContentView>): GroupContentView => ({
  classId: 'class-1',
  classTitle: 'Class 1',
  groupId: 'group-1',
  groupName: 'Group 1',
  order: 0,
  status: 'PUBLISHED',
  ...overrides,
});

describe('ContentAccessService', () => {
  let groupAccess: jest.Mocked<IGroupAccessPort>;
  let service: ContentAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    groupAccess = createFakeGroupAccess();
    service = new ContentAccessService(groupAccess);
  });

  describe('getAccessibleContentForUser', () => {
    it('should return all content for admin', async () => {
      groupAccess.findAllPublished.mockResolvedValue([
        contentView({ classId: 'class-1', classTitle: 'Class 1', groupName: 'Group 1' }),
      ]);

      const result = await service.getAccessibleContentForUser('admin-1', 'ADMIN');

      expect(groupAccess.findAllPublished).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].classId).toBe('class-1');
      expect(result[0].classTitle).toBe('Class 1');
    });

    it('should return content for teacher owned groups', async () => {
      groupAccess.findByTeacher.mockResolvedValue([
        contentView({ groupId: 'group-1', groupName: 'My Group' }),
      ]);

      const result = await service.getAccessibleContentForUser('teacher-1', 'TEACHER');

      expect(groupAccess.findByTeacher).toHaveBeenCalledWith('teacher-1');
      expect(result).toHaveLength(1);
      expect(result[0].groupName).toBe('My Group');
    });

    it('should return content for student in active groups', async () => {
      groupAccess.findByStudent.mockResolvedValue([
        contentView({ groupId: 'group-1', groupName: 'Student Group' }),
      ]);

      const result = await service.getAccessibleContentForUser('student-1', 'STUDENT');

      expect(groupAccess.findByStudent).toHaveBeenCalledWith('student-1');
      expect(result).toHaveLength(1);
      expect(result[0].classTitle).toBe('Class 1');
    });

    it('should return empty array for student with no groups', async () => {
      groupAccess.findByStudent.mockResolvedValue([]);

      const result = await service.getAccessibleContentForUser('student-1', 'STUDENT');

      expect(result).toHaveLength(0);
    });
  });

  describe('canAccessClass', () => {
    it('should return true for admin', async () => {
      groupAccess.canAccess.mockResolvedValue(true);

      const result = await service.canAccessClass('admin-1', 'ADMIN', 'class-1');

      expect(groupAccess.canAccess).toHaveBeenCalledWith('admin-1', 'ADMIN', 'class-1');
      expect(result).toBe(true);
    });

    it('should return true for class owner teacher', async () => {
      groupAccess.canAccess.mockResolvedValue(true);

      const result = await service.canAccessClass('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(true);
    });

    it('should return false for non-owner teacher', async () => {
      groupAccess.canAccess.mockResolvedValue(false);

      const result = await service.canAccessClass('teacher-1', 'TEACHER', 'class-1');

      expect(result).toBe(false);
    });

    it('should return true for student in group with class', async () => {
      groupAccess.canAccess.mockResolvedValue(true);

      const result = await service.canAccessClass('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(true);
    });

    it('should return false for student not in group', async () => {
      groupAccess.canAccess.mockResolvedValue(false);

      const result = await service.canAccessClass('student-1', 'STUDENT', 'class-1');

      expect(result).toBe(false);
    });
  });
});
