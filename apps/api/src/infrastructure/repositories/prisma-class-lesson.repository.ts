/**
 * Prisma-based ClassLesson Repository.
 *
 * Implements IClassLessonRepository using Prisma ORM.
 * Handles all database operations for ClassLesson entities.
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';
import type { IClassLessonRepository } from '@/domain/repositories/class.repository.js';
import type { ClassLessonEntity } from '@/domain/entities/class.entity.js';

/**
 * Maps Prisma ClassLesson model to ClassLessonEntity
 */
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
  /**
   * Find all lessons for a specific class
   */
  async findByClassId(classId: string): Promise<ClassLessonEntity[]> {
    const lessons = await prisma.classLesson.findMany({
      where: { classId },
      orderBy: { order: 'asc' },
      include: { recipe: { select: { id: true, title: true, expectedDurationMinutes: true } } },
    });

    return lessons.map(mapPrismaToClassLessonEntity);
  }

  /**
   * Create a new lesson
   */
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

  /**
   * Update an existing lesson
   */
  async update(
    id: string,
    lessonData: Partial<Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassLessonEntity> {
    const updateData: Record<string, unknown> = {};

    if (lessonData.classId !== undefined) {
      updateData.classId = lessonData.classId;
    }
    if (lessonData.recipeId !== undefined) {
      updateData.recipeId = lessonData.recipeId;
    }
    if (lessonData.order !== undefined) {
      updateData.order = lessonData.order;
    }

    const updated = await prisma.classLesson.update({
      where: { id },
      data: updateData,
    });

    return mapPrismaToClassLessonEntity(updated);
  }

  /**
   * Delete a lesson by its ID
   */
  async delete(id: string): Promise<void> {
    await prisma.classLesson.delete({
      where: { id },
    });
  }

  /**
   * Reorder lessons within a class
   */
  async reorder(classId: string, lessonIds: string[]): Promise<void> {
    // Fetch current lessons to get their current order values
    const lessons = await prisma.classLesson.findMany({
      where: { id: { in: lessonIds }, classId },
      select: { id: true, order: true },
    });

    // Create a map of current order values
    const currentOrderMap = new Map(lessons.map((l) => [l.id, l.order]));

    // Use a two-phase approach to avoid unique constraint violation:
    // 1. First, assign temporary unique values (current + large offset)
    // 2. Then, assign final order values
    const TEMP_OFFSET = 10000;

    const tempAssignments = lessonIds.map((lessonId, index) =>
      prisma.classLesson.update({
        where: { id: lessonId, classId },
        data: { order: (currentOrderMap.get(lessonId) ?? index) + TEMP_OFFSET },
      }),
    );

    await prisma.$transaction(tempAssignments);

    // Now assign the final order values
    const finalAssignments = lessonIds.map((lessonId, index) =>
      prisma.classLesson.update({
        where: { id: lessonId, classId },
        data: { order: index },
      }),
    );

    await prisma.$transaction(finalAssignments);
  }
}
