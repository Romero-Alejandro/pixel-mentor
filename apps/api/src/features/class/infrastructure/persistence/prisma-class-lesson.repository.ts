/**
 * Prisma-based ClassLesson Repository.
 */

import type { IClassLessonRepository } from '../../domain/ports/class.repository.port';
import type { ClassLessonEntity } from '../../domain/entities/class.entity';

import { prisma } from '@/database/client.js';

function mapPrismaToClassLessonEntity(prismaLesson: {
  id: string;
  classId: string;
  recipeId: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  recipe?: { id: string; title: string; expectedDurationMinutes: number | null } | null;
}): ClassLessonEntity {
  return {
    id: prismaLesson.id,
    classId: prismaLesson.classId,
    recipeId: prismaLesson.recipeId,
    order: prismaLesson.order,
    createdAt: prismaLesson.createdAt,
    updatedAt: prismaLesson.updatedAt,
    recipe: prismaLesson.recipe ?? undefined,
  };
}

export class PrismaClassLessonRepository implements IClassLessonRepository {
  async findByClassId(classId: string): Promise<ClassLessonEntity[]> {
    const lessons = await prisma.classLesson.findMany({
      where: { classId },
      orderBy: { order: 'asc' },
      include: { recipe: { select: { id: true, title: true, expectedDurationMinutes: true } } },
    });
    return lessons.map(mapPrismaToClassLessonEntity);
  }

  async create(
    lessonData: Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassLessonEntity> {
    const created = await prisma.classLesson.create({
      data: {
        classId: lessonData.classId,
        recipeId: lessonData.recipeId,
        order: lessonData.order,
      },
    });
    return mapPrismaToClassLessonEntity(created);
  }

  async update(
    id: string,
    lessonData: Partial<Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassLessonEntity> {
    const updateData: Record<string, unknown> = {};
    if (lessonData.classId !== undefined) updateData.classId = lessonData.classId;
    if (lessonData.recipeId !== undefined) updateData.recipeId = lessonData.recipeId;
    if (lessonData.order !== undefined) updateData.order = lessonData.order;

    const updated = await prisma.classLesson.update({
      where: { id },
      data: updateData,
    });
    return mapPrismaToClassLessonEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.classLesson.delete({ where: { id } });
  }

  async reorder(classId: string, lessonIds: string[]): Promise<void> {
    const lessons = await prisma.classLesson.findMany({
      where: { id: { in: lessonIds }, classId },
      select: { id: true, order: true },
    });

    const currentOrderMap = new Map(lessons.map((l) => [l.id, l.order]));
    const TEMP_OFFSET = 10000;

    const tempAssignments = lessonIds.map((lessonId, index) =>
      prisma.classLesson.update({
        where: { id: lessonId, classId },
        data: { order: (currentOrderMap.get(lessonId) ?? index) + TEMP_OFFSET },
      }),
    );
    await prisma.$transaction(tempAssignments);

    const finalAssignments = lessonIds.map((lessonId, index) =>
      prisma.classLesson.update({
        where: { id: lessonId, classId },
        data: { order: index },
      }),
    );
    await prisma.$transaction(finalAssignments);
  }
}
