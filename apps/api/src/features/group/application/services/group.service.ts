import { prisma } from '@/database/client.js';

import type {
  GroupEntity,
  GroupMemberEntity,
  GroupClassEntity,
} from '../../domain/entities/group.entity.js';
import type {
  IGroupRepository,
  IGroupMemberRepository,
  IGroupClassRepository,
} from '../../domain/ports/group.repository.port.js';
import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';

export interface CreateGroupInput {
  name: string;
  description?: string;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
}

export interface AddGroupMembersInput {
  studentIds: string[];
}

export interface GroupClassInput {
  classId: string;
  order?: number;
}

export interface ReorderGroupClassesInput {
  classIds: string[];
}

export class GroupNotFoundError extends Error {
  readonly code = 'GROUP_NOT_FOUND' as const;
  readonly groupId: string;

  constructor(groupId: string) {
    super(`Group with ID ${groupId} not found`);
    this.name = 'GroupNotFoundError';
    this.groupId = groupId;
  }
}

export class GroupOwnershipError extends Error {
  readonly code = 'GROUP_OWNERSHIP_ERROR' as const;
  readonly groupId: string;
  readonly userId: string;

  constructor(groupId: string, userId: string) {
    super(`Group ${groupId} does not belong to user ${userId}`);
    this.name = 'GroupOwnershipError';
    this.groupId = groupId;
    this.userId = userId;
  }
}

export class StudentNotFoundError extends Error {
  readonly code = 'STUDENT_NOT_FOUND' as const;
  readonly studentId: string;

  constructor(studentId: string) {
    super(`Student with ID ${studentId} not found`);
    this.name = 'StudentNotFoundError';
    this.studentId = studentId;
  }
}

export class ClassNotFoundError extends Error {
  readonly code = 'CLASS_NOT_FOUND' as const;
  readonly classId: string;

  constructor(classId: string) {
    super(`Class with ID ${classId} not found`);
    this.name = 'ClassNotFoundError';
    this.classId = classId;
  }
}

export class GroupValidationError extends Error {
  readonly code = 'GROUP_VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'GroupValidationError';
  }
}

export class GroupService {
  constructor(
    private groupRepo: IGroupRepository,
    private memberRepo: IGroupMemberRepository,
    private classRepo: IGroupClassRepository,
  ) {}

  async createGroup(teacherId: string, data: CreateGroupInput): Promise<GroupEntity> {
    if (!data.name || data.name.trim().length === 0) {
      throw new GroupValidationError('Group name is required');
    }

    return this.groupRepo.create({
      name: data.name.trim(),
      description: data.description?.trim(),
      teacherId,
    });
  }

  async getGroup(id: string): Promise<GroupEntity> {
    const group = await this.groupRepo.findById(id);
    if (!group) {
      throw new GroupNotFoundError(id);
    }
    return group;
  }

  async getGroupsByTeacher(
    teacherId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ groups: GroupEntity[]; total: number; page: number; limit: number }> {
    return this.groupRepo.findByTeacherId(teacherId, options);
  }

  async updateGroup(id: string, teacherId: string, data: UpdateGroupInput): Promise<GroupEntity> {
    const group = await this.groupRepo.findById(id);
    if (!group) {
      throw new GroupNotFoundError(id);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(id, teacherId);
    }

    return this.groupRepo.update(id, {
      name: data.name?.trim(),
      description: data.description?.trim(),
    });
  }

  async deleteGroup(id: string, teacherId: string): Promise<void> {
    const group = await this.groupRepo.findById(id);
    if (!group) {
      throw new GroupNotFoundError(id);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(id, teacherId);
    }

    await this.groupRepo.delete(id);
  }

  async addMembers(
    groupId: string,
    teacherId: string,
    data: AddGroupMembersInput,
  ): Promise<GroupMemberEntity[]> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    if (!data.studentIds || data.studentIds.length === 0) {
      throw new GroupValidationError('At least one student ID is required');
    }

    const students = await prisma.user.findMany({
      where: {
        id: { in: data.studentIds },
        role: 'STUDENT',
      },
      select: { id: true },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const notFound = data.studentIds.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) {
      throw new StudentNotFoundError(notFound[0]);
    }

    const existingMembers = await this.memberRepo.findByGroupId(groupId);
    const existingIds = new Set(existingMembers.map((m) => m.studentId));

    const newStudents = data.studentIds.filter((id) => !existingIds.has(id));
    if (newStudents.length === 0) {
      return existingMembers as GroupMemberEntity[];
    }

    const created = await this.memberRepo.createMany(
      newStudents.map((studentId) => ({ groupId, studentId })),
    );

    return created as GroupMemberEntity[];
  }

  async removeMember(groupId: string, teacherId: string, studentId: string): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    await this.memberRepo.delete(groupId, studentId);
  }

  async removeMembers(groupId: string, teacherId: string, studentIds: string[]): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    await this.memberRepo.deleteMany(groupId, studentIds);
  }

  async getMembers(
    groupId: string,
    teacherId: string,
  ): Promise<
    { id: string; studentId: string; status: string; user?: { name: string; email: string } }[]
  > {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    return this.memberRepo.findByGroupId(groupId);
  }

  async assignClass(
    groupId: string,
    teacherId: string,
    data: GroupClassInput,
  ): Promise<GroupClassEntity> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    const classEntity = await prisma.class.findUnique({
      where: { id: data.classId },
      select: { id: true, tutorId: true },
    });

    if (!classEntity) {
      throw new ClassNotFoundError(data.classId);
    }

    if (classEntity.tutorId !== teacherId) {
      throw new GroupValidationError('Cannot assign a class that you do not own');
    }

    const existing = await this.classRepo.findByGroupIdAndClassId(groupId, data.classId);
    if (existing) {
      throw new GroupValidationError('Class is already assigned to this group');
    }

    const existingClasses = await this.classRepo.findByGroupId(groupId);
    const order = data.order ?? Math.max(...existingClasses.map((c) => c.order), -1) + 1;

    const created = await this.classRepo.create({
      groupId,
      classId: data.classId,
      order,
    });

    return created as GroupClassEntity;
  }

  async unassignClass(groupId: string, teacherId: string, classId: string): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    await this.classRepo.delete(groupId, classId);
  }

  async getGroupClasses(
    groupId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<
    {
      id: string;
      classId: string;
      order: number;
      class?: { id: string; title: string; status: string };
    }[]
  > {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (userRole === 'TEACHER' && group.teacherId !== userId) {
      throw new GroupOwnershipError(groupId, userId);
    }

    if (userRole === 'STUDENT') {
      const membership = await this.memberRepo.findByGroupIdAndStudentId(groupId, userId);
      if (!membership || membership.status !== 'ACTIVE') {
        throw new GroupValidationError('You are not an active member of this group');
      }
    }

    return this.classRepo.findByGroupId(groupId);
  }

  async reorderClasses(
    groupId: string,
    teacherId: string,
    data: ReorderGroupClassesInput,
  ): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    if (group.teacherId !== teacherId) {
      throw new GroupOwnershipError(groupId, teacherId);
    }

    const existing = await this.classRepo.findByGroupId(groupId);
    const existingIds = new Set(existing.map((c) => c.classId));

    for (const id of data.classIds) {
      if (!existingIds.has(id)) {
        throw new ClassNotFoundError(id);
      }
    }

    await this.classRepo.reorder(groupId, data.classIds);
  }
}

export class GroupServiceDeps {
  constructor(
    readonly groupRepo: IGroupRepository,
    readonly memberRepo: IGroupMemberRepository,
    readonly classRepo: IGroupClassRepository,
  ) {}

  createService(): GroupService {
    return new GroupService(this.groupRepo, this.memberRepo, this.classRepo);
  }
}
