/**
 * Prisma-based ClassLesson Repository.
 *
 * Implements IClassLessonRepository using Prisma ORM.
 * Extends PrismaBaseRepository for common CRUD operations.
 */

import { PrismaBaseRepository } from './prisma-base.repository.js';

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

type PrismaClassLesson = {
  id: string;
  classId: string;
  recipeId: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  recipe?: { id: string; title: string; expectedDurationMinutes: number | null } | null;
};

type CreateLessonInput = Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateLessonInput = Partial<Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>>;

export class PrismaClassLessonRepository
  extends PrismaBaseRepository<
    ClassLessonEntity,
    PrismaClassLesson,
    CreateLessonInput,
    UpdateLessonInput
  >
  implements IClassLessonRepository
{
  constructor() {
    super(prisma.classLesson as any, mapPrismaToClassLessonEntity);
  }

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
   * Override to handle field mapping
   */
  async create(lessonData: CreateLessonInput): Promise<ClassLessonEntity> {
    const data = {
      classId: lessonData.classId,
      recipeId: lessonData.recipeId,
      order: lessonData.order,
    };

    return super.create(data as any);
  }

  /**
   * Update an existing lesson
   * Override to handle field mapping
   */
  async update(id: string, lessonData: UpdateLessonInput): Promise<ClassLessonEntity> {
    const updateData = this.prepareUpdateData({
      classId: lessonData.classId,
      recipeId: lessonData.recipeId,
      order: lessonData.order,
    });

    return super.update(id, updateData as any);
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
