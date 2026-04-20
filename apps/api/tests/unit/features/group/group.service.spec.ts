import { prisma } from '@/database/client.js';
import {
  GroupService,
  GroupNotFoundError,
  GroupOwnershipError,
  StudentNotFoundError,
  ClassNotFoundError,
  GroupValidationError,
} from '@/features/group/application/services/group.service.js';
import type {
  IGroupRepository,
  IGroupMemberRepository,
  IGroupClassRepository,
} from '@/features/group/domain/ports/group.repository.port.js';

jest.mock('@/database/client.js', () => ({
  prisma: {
    user: { findMany: jest.fn() },
    class: { findUnique: jest.fn() },
  },
}));

const createMockGroupRepository = (): jest.Mocked<IGroupRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByTeacherId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findWithMembers: jest.fn(),
});

const createMockMemberRepository = (): jest.Mocked<IGroupMemberRepository> => ({
  create: jest.fn(),
  createMany: jest.fn(),
  findByGroupId: jest.fn(),
  findByStudentId: jest.fn(),
  findByGroupIdAndStudentId: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  updateStatus: jest.fn(),
});

const createMockClassRepository = (): jest.Mocked<IGroupClassRepository> => ({
  create: jest.fn(),
  createMany: jest.fn(),
  findByGroupId: jest.fn(),
  findByClassId: jest.fn(),
  findByGroupIdAndClassId: jest.fn(),
  delete: jest.fn(),
  updateOrder: jest.fn(),
  reorder: jest.fn(),
});

describe('GroupService', () => {
  let groupRepo: jest.Mocked<IGroupRepository>;
  let memberRepo: jest.Mocked<IGroupMemberRepository>;
  let classRepo: jest.Mocked<IGroupClassRepository>;
  let service: GroupService;

  beforeEach(() => {
    jest.clearAllMocks();
    groupRepo = createMockGroupRepository();
    memberRepo = createMockMemberRepository();
    classRepo = createMockClassRepository();
    service = new GroupService(groupRepo, memberRepo, classRepo);
  });

  describe('createGroup', () => {
    it('should create a group with valid data', async () => {
      const input = { name: 'Test Group', description: 'Test Description' };
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        description: 'Test Description',
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.create.mockResolvedValue(mockGroup);

      const result = await service.createGroup('teacher-1', input);

      expect(groupRepo.create).toHaveBeenCalledWith({
        name: 'Test Group',
        description: 'Test Description',
        teacherId: 'teacher-1',
      });
      expect(result).toEqual(mockGroup);
    });

    it('should throw error for empty name', async () => {
      await expect(service.createGroup('teacher-1', { name: '' })).rejects.toThrow(
        GroupValidationError,
      );
      await expect(service.createGroup('teacher-1', { name: '   ' })).rejects.toThrow(
        GroupValidationError,
      );
    });

    it('should trim whitespace from name and description', async () => {
      const input = { name: '  Test Group  ', description: '  Description  ' };
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        description: 'Description',
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.create.mockResolvedValue(mockGroup);

      await service.createGroup('teacher-1', input);

      expect(groupRepo.create).toHaveBeenCalledWith({
        name: 'Test Group',
        description: 'Description',
        teacherId: 'teacher-1',
      });
    });
  });

  describe('getGroup', () => {
    it('should return group when found', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);

      const result = await service.getGroup('group-1');

      expect(result).toEqual(mockGroup);
    });

    it('should throw GroupNotFoundError when not found', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(service.getGroup('non-existent')).rejects.toThrow(GroupNotFoundError);
    });
  });

  describe('getGroupsByTeacher', () => {
    it('should return paginated groups for teacher', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Group 1',
          teacherId: 'teacher-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      groupRepo.findByTeacherId.mockResolvedValue({
        groups: mockGroups,
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await service.getGroupsByTeacher('teacher-1');

      expect(result.groups).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateGroup', () => {
    it('should update group when owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Updated',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      groupRepo.update.mockResolvedValue(mockGroup);

      const result = await service.updateGroup('group-1', 'teacher-1', { name: 'Updated' });

      expect(groupRepo.update).toHaveBeenCalled();
      expect(result).toEqual(mockGroup);
    });

    it('should throw GroupNotFoundError when not found', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(service.updateGroup('group-1', 'teacher-1', { name: 'Test' })).rejects.toThrow(
        GroupNotFoundError,
      );
    });

    it('should throw GroupOwnershipError when not owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'other-teacher',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);

      await expect(service.updateGroup('group-1', 'teacher-1', { name: 'Test' })).rejects.toThrow(
        GroupOwnershipError,
      );
    });
  });

  describe('deleteGroup', () => {
    it('should delete group when owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      groupRepo.delete.mockResolvedValue();

      await service.deleteGroup('group-1', 'teacher-1');

      expect(groupRepo.delete).toHaveBeenCalledWith('group-1');
    });

    it('should throw GroupOwnershipError when not owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'other-teacher',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);

      await expect(service.deleteGroup('group-1', 'teacher-1')).rejects.toThrow(
        GroupOwnershipError,
      );
    });
  });

  describe('addMembers', () => {
    it('should add members when valid students', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      memberRepo.findByGroupId.mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'student-1' },
        { id: 'student-2' },
      ]);
      memberRepo.createMany.mockResolvedValue([
        {
          id: 'member-1',
          groupId: 'group-1',
          studentId: 'student-1',
          joinedAt: new Date(),
          status: 'ACTIVE',
        },
        {
          id: 'member-2',
          groupId: 'group-1',
          studentId: 'student-2',
          joinedAt: new Date(),
          status: 'ACTIVE',
        },
      ]);

      const result = await service.addMembers('group-1', 'teacher-1', {
        studentIds: ['student-1', 'student-2'],
      });

      expect(result).toHaveLength(2);
    });

    it('should throw GroupNotFoundError when group not found', async () => {
      groupRepo.findById.mockResolvedValue(null);

      await expect(
        service.addMembers('group-1', 'teacher-1', { studentIds: ['student-1'] }),
      ).rejects.toThrow(GroupNotFoundError);
    });

    it('should throw GroupValidationError when no student IDs', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);

      await expect(service.addMembers('group-1', 'teacher-1', { studentIds: [] })).rejects.toThrow(
        GroupValidationError,
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member when owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      memberRepo.delete.mockResolvedValue();

      await service.removeMember('group-1', 'teacher-1', 'student-1');

      expect(memberRepo.delete).toHaveBeenCalledWith('group-1', 'student-1');
    });

    it('should throw GroupOwnershipError when not owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'other-teacher',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);

      await expect(service.removeMember('group-1', 'teacher-1', 'student-1')).rejects.toThrow(
        GroupOwnershipError,
      );
    });
  });

  describe('assignClass', () => {
    it('should assign class to group', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue({
        id: 'class-1',
        tutorId: 'teacher-1',
      });
      classRepo.findByGroupIdAndClassId.mockResolvedValue(null);
      classRepo.findByGroupId.mockResolvedValue([]);
      classRepo.create.mockResolvedValue({
        id: 'gc-1',
        groupId: 'group-1',
        classId: 'class-1',
        order: 0,
      });

      const result = await service.assignClass('group-1', 'teacher-1', { classId: 'class-1' });

      expect(result).toEqual({ id: 'gc-1', groupId: 'group-1', classId: 'class-1', order: 0 });
    });

    it('should throw ClassNotFoundError when class not found', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.assignClass('group-1', 'teacher-1', { classId: 'class-1' }),
      ).rejects.toThrow(ClassNotFoundError);
    });

    it('should throw error when class already assigned', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue({
        id: 'class-1',
        tutorId: 'teacher-1',
      });
      classRepo.findByGroupIdAndClassId.mockResolvedValue({ id: 'gc-1', order: 0 });

      await expect(
        service.assignClass('group-1', 'teacher-1', { classId: 'class-1' }),
      ).rejects.toThrow(GroupValidationError);
    });
  });

  describe('unassignClass', () => {
    it('should unassign class when owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      classRepo.delete.mockResolvedValue();

      await service.unassignClass('group-1', 'teacher-1', 'class-1');

      expect(classRepo.delete).toHaveBeenCalledWith('group-1', 'class-1');
    });

    it('should throw GroupOwnershipError when not owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'other-teacher',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);

      await expect(service.unassignClass('group-1', 'teacher-1', 'class-1')).rejects.toThrow(
        GroupOwnershipError,
      );
    });
  });

  describe('reorderClasses', () => {
    it('should reorder classes when valid', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      classRepo.findByGroupId.mockResolvedValue([
        { id: 'gc-1', classId: 'class-1', order: 0 },
        { id: 'gc-2', classId: 'class-2', order: 1 },
      ]);
      classRepo.reorder.mockResolvedValue();

      await service.reorderClasses('group-1', 'teacher-1', { classIds: ['class-2', 'class-1'] });

      expect(classRepo.reorder).toHaveBeenCalledWith('group-1', ['class-2', 'class-1']);
    });

    it('should throw ClassNotFoundError for invalid class ID', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      classRepo.findByGroupId.mockResolvedValue([{ id: 'gc-1', classId: 'class-1', order: 0 }]);

      await expect(
        service.reorderClasses('group-1', 'teacher-1', { classIds: ['class-1', 'non-existent'] }),
      ).rejects.toThrow(ClassNotFoundError);
    });
  });

  describe('getGroupClasses', () => {
    it('should return classes for teacher owner', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      classRepo.findByGroupId.mockResolvedValue([
        {
          id: 'gc-1',
          classId: 'class-1',
          order: 0,
          class: { id: 'class-1', title: 'Class 1', status: 'PUBLISHED' },
        },
      ]);

      const result = await service.getGroupClasses('group-1', 'teacher-1', 'TEACHER');

      expect(result).toHaveLength(1);
    });

    it('should return classes for active student member', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      memberRepo.findByGroupIdAndStudentId.mockResolvedValue({ id: 'member-1', status: 'ACTIVE' });
      classRepo.findByGroupId.mockResolvedValue([{ id: 'gc-1', classId: 'class-1', order: 0 }]);

      const result = await service.getGroupClasses('group-1', 'student-1', 'STUDENT');

      expect(result).toHaveLength(1);
    });

    it('should throw error for non-member student', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test',
        description: null,
        teacherId: 'teacher-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      groupRepo.findById.mockResolvedValue(mockGroup);
      memberRepo.findByGroupIdAndStudentId.mockResolvedValue(null);

      await expect(service.getGroupClasses('group-1', 'student-1', 'STUDENT')).rejects.toThrow(
        GroupValidationError,
      );
    });
  });
});
