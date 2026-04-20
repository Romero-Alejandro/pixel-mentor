import type { GroupEntity, GroupWithMembers } from '../../domain/entities/group.entity.js';
import type {
  IGroupRepository,
  IGroupMemberRepository,
  IGroupClassRepository,
} from '../../domain/ports/group.repository.port.js';

import { prisma } from '@/database/client.js';

export class PrismaGroupRepository implements IGroupRepository {
  async create(data: {
    name: string;
    description?: string;
    teacherId: string;
  }): Promise<GroupEntity> {
    const group = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        teacherId: data.teacherId,
      },
    });

    return group as GroupEntity;
  }

  async findById(id: string): Promise<GroupEntity | null> {
    const group = await prisma.group.findUnique({
      where: { id },
    });

    return group as GroupEntity | null;
  }

  async findByTeacherId(
    teacherId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ groups: GroupEntity[]; total: number; page: number; limit: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.group.count({ where: { teacherId } }),
    ]);

    return {
      groups: groups as GroupEntity[],
      total,
      page,
      limit,
    };
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<GroupEntity> {
    const updateData: { name?: string; description?: string | null } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const group = await prisma.group.update({
      where: { id },
      data: updateData,
    });

    return group as GroupEntity;
  }

  async delete(id: string): Promise<void> {
    await prisma.group.delete({ where: { id } });
  }

  async findWithMembers(id: string): Promise<GroupWithMembers | null> {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: true,
      },
    });

    if (!group) return null;

    return {
      ...group,
      members: group.memberships as GroupWithMembers['members'],
      memberCount: group.memberships.length,
    } as GroupWithMembers;
  }
}

export class PrismaGroupMemberRepository implements IGroupMemberRepository {
  async create(data: {
    groupId: string;
    studentId: string;
    status?: string;
  }): Promise<{ id: string; groupId: string; studentId: string; joinedAt: Date; status: string }> {
    const member = await prisma.groupMember.create({
      data: {
        groupId: data.groupId,
        studentId: data.studentId,
        status: (data.status as any) || 'ACTIVE',
      },
    });

    return {
      id: member.id,
      groupId: member.groupId,
      studentId: member.studentId,
      joinedAt: member.joinedAt,
      status: member.status as string,
    };
  }

  async createMany(
    data: { groupId: string; studentId: string }[],
  ): Promise<{ id: string; groupId: string; studentId: string; joinedAt: Date; status: string }[]> {
    const members = await prisma.groupMember.createManyAndReturn({
      data: data.map((d) => ({
        groupId: d.groupId,
        studentId: d.studentId,
        status: 'ACTIVE' as const,
      })),
    });

    return members.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      studentId: m.studentId,
      joinedAt: m.joinedAt,
      status: m.status as string,
    }));
  }

  async findByGroupId(
    groupId: string,
  ): Promise<
    { id: string; studentId: string; status: string; user?: { name: string; email: string } }[]
  > {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        student: {
          select: { name: true, email: true },
        },
      },
    });

    return members.map((m) => ({
      id: m.id,
      studentId: m.studentId,
      status: m.status as string,
      user: m.student ? { name: m.student.name, email: m.student.email } : undefined,
    }));
  }

  async findByStudentId(
    studentId: string,
  ): Promise<{ id: string; groupId: string; status: string }[]> {
    const members = await prisma.groupMember.findMany({
      where: { studentId },
    });

    return members.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      status: m.status as string,
    }));
  }

  async findByGroupIdAndStudentId(
    groupId: string,
    studentId: string,
  ): Promise<{ id: string; status: string } | null> {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_studentId: { groupId, studentId },
      },
    });

    if (!member) return null;

    return {
      id: member.id,
      status: member.status as string,
    };
  }

  async delete(groupId: string, studentId: string): Promise<void> {
    await prisma.groupMember.delete({
      where: {
        groupId_studentId: { groupId, studentId },
      },
    });
  }

  async deleteMany(groupId: string, studentIds: string[]): Promise<void> {
    await prisma.groupMember.deleteMany({
      where: {
        groupId,
        studentId: { in: studentIds },
      },
    });
  }

  async updateStatus(groupId: string, studentId: string, status: string): Promise<void> {
    await prisma.groupMember.update({
      where: {
        groupId_studentId: { groupId, studentId },
      },
      data: { status: status as any },
    });
  }
}

export class PrismaGroupClassRepository implements IGroupClassRepository {
  async create(data: {
    groupId: string;
    classId: string;
    order: number;
  }): Promise<{ id: string; groupId: string; classId: string; order: number }> {
    const gc = await prisma.groupClass.create({
      data: {
        groupId: data.groupId,
        classId: data.classId,
        order: data.order,
      },
    });

    return {
      id: gc.id,
      groupId: gc.groupId,
      classId: gc.classId,
      order: gc.order,
    };
  }

  async createMany(
    data: { groupId: string; classId: string; order: number }[],
  ): Promise<{ id: string; groupId: string; classId: string; order: number }[]> {
    const gcs = await prisma.groupClass.createManyAndReturn({
      data: data.map((d) => ({
        groupId: d.groupId,
        classId: d.classId,
        order: d.order,
      })),
    });

    return gcs.map((gc) => ({
      id: gc.id,
      groupId: gc.groupId,
      classId: gc.classId,
      order: gc.order,
    }));
  }

  async findByGroupId(groupId: string): Promise<
    {
      id: string;
      classId: string;
      order: number;
      class?: { id: string; title: string; status: string };
    }[]
  > {
    const gcs = await prisma.groupClass.findMany({
      where: { groupId },
      orderBy: { order: 'asc' },
      include: {
        class: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return gcs.map((gc) => ({
      id: gc.id,
      classId: gc.classId,
      order: gc.order,
      class: gc.class
        ? { id: gc.class.id, title: gc.class.title, status: gc.class.status as string }
        : undefined,
    }));
  }

  async findByClassId(classId: string): Promise<{ id: string; groupId: string; order: number }[]> {
    const gcs = await prisma.groupClass.findMany({
      where: { classId },
    });

    return gcs.map((gc) => ({
      id: gc.id,
      groupId: gc.groupId,
      order: gc.order,
    }));
  }

  async findByGroupIdAndClassId(
    groupId: string,
    classId: string,
  ): Promise<{ id: string; order: number } | null> {
    const gc = await prisma.groupClass.findUnique({
      where: {
        groupId_classId: { groupId, classId },
      },
    });

    if (!gc) return null;

    return {
      id: gc.id,
      order: gc.order,
    };
  }

  async delete(groupId: string, classId: string): Promise<void> {
    await prisma.groupClass.delete({
      where: {
        groupId_classId: { groupId, classId },
      },
    });
  }

  async updateOrder(groupId: string, classId: string, order: number): Promise<void> {
    await prisma.groupClass.update({
      where: {
        groupId_classId: { groupId, classId },
      },
      data: { order },
    });
  }

  async reorder(groupId: string, classIds: string[]): Promise<void> {
    await prisma.$transaction(
      classIds.map((classId, index) =>
        prisma.groupClass.update({
          where: {
            groupId_classId: { groupId, classId },
          },
          data: { order: index },
        }),
      ),
    );
  }
}
