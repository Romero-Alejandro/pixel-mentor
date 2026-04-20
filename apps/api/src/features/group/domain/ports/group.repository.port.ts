import type { GroupEntity, GroupWithMembers } from '../entities/group.entity.js';

export interface IGroupRepository {
  create(data: { name: string; description?: string; teacherId: string }): Promise<GroupEntity>;
  findById(id: string): Promise<GroupEntity | null>;
  findByTeacherId(
    teacherId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ groups: GroupEntity[]; total: number; page: number; limit: number }>;
  update(id: string, data: { name?: string; description?: string }): Promise<GroupEntity>;
  delete(id: string): Promise<void>;
  findWithMembers(id: string): Promise<GroupWithMembers | null>;
}

export interface IGroupMemberRepository {
  create(data: {
    groupId: string;
    studentId: string;
    status?: string;
  }): Promise<{ id: string; groupId: string; studentId: string; joinedAt: Date; status: string }>;
  createMany(
    data: { groupId: string; studentId: string }[],
  ): Promise<{ id: string; groupId: string; studentId: string; joinedAt: Date; status: string }[]>;
  findByGroupId(
    groupId: string,
  ): Promise<
    { id: string; studentId: string; status: string; user?: { name: string; email: string } }[]
  >;
  findByStudentId(studentId: string): Promise<{ id: string; groupId: string; status: string }[]>;
  findByGroupIdAndStudentId(
    groupId: string,
    studentId: string,
  ): Promise<{ id: string; status: string } | null>;
  delete(groupId: string, studentId: string): Promise<void>;
  deleteMany(groupId: string, studentIds: string[]): Promise<void>;
  updateStatus(groupId: string, studentId: string, status: string): Promise<void>;
}

export interface IGroupClassRepository {
  create(data: {
    groupId: string;
    classId: string;
    order: number;
  }): Promise<{ id: string; groupId: string; classId: string; order: number }>;
  createMany(
    data: { groupId: string; classId: string; order: number }[],
  ): Promise<{ id: string; groupId: string; classId: string; order: number }[]>;
  findByGroupId(groupId: string): Promise<
    {
      id: string;
      classId: string;
      order: number;
      class?: { id: string; title: string; status: string };
    }[]
  >;
  findByClassId(classId: string): Promise<{ id: string; groupId: string; order: number }[]>;
  findByGroupIdAndClassId(
    groupId: string,
    classId: string,
  ): Promise<{ id: string; order: number } | null>;
  delete(groupId: string, classId: string): Promise<void>;
  updateOrder(groupId: string, classId: string, order: number): Promise<void>;
  reorder(groupId: string, classIds: string[]): Promise<void>;
}
