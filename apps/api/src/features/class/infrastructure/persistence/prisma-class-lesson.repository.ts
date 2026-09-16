/**
 * Prisma-based ClassLesson Repository.
 */

import type { IClassLessonRepository } from '@/features/class/domain/ports/class.repository.port.js';
import type { ClassLessonEntity } from '@/features/class/domain/entities/class.entity.js';
import { LessonNotFoundError } from '@/shared/errors/domain-errors.js';
import { prisma } from '@/database/client.js';

function mapPrismaToClassLessonEntity(prismaLesson: {
  id: string;
  classId: string;
  recipeId: string;
  title?: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  recipe?: {
    id: string;
    title: string;
    expectedDurationMinutes: number | null;
    steps?: Array<{
      id: string;
      order: number;
      script?: unknown;
    }>;
  } | null;
}): ClassLessonEntity {
  return {
    id: prismaLesson.id,
    classId: prismaLesson.classId,
    recipeId: prismaLesson.recipeId,
    title: prismaLesson.title ?? undefined,
    order: prismaLesson.order,
    createdAt: prismaLesson.createdAt,
    updatedAt: prismaLesson.updatedAt,
    recipe: prismaLesson.recipe
      ? {
          ...prismaLesson.recipe,
          steps: prismaLesson.recipe.steps?.map((s) => ({
            ...s,
            script: s.script as Record<string, unknown> | undefined,
          })),
        }
      : undefined,
  };
}

export class PrismaClassLessonRepository implements IClassLessonRepository {
  async findByClassId(classId: string): Promise<ClassLessonEntity[]> {
    const lessons = await prisma.classLesson.findMany({
      where: { classId },
      orderBy: { order: 'asc' },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            expectedDurationMinutes: true,
            steps: { select: { id: true, order: true, script: true } },
          },
        },
      },
    });
    return lessons.map(mapPrismaToClassLessonEntity);
  }

  async findById(id: string): Promise<ClassLessonEntity | null> {
    const lesson = await prisma.classLesson.findUnique({
      where: { id },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            expectedDurationMinutes: true,
            steps: { select: { id: true, order: true, script: true } },
          },
        },
      },
    });
    return lesson ? mapPrismaToClassLessonEntity(lesson) : null;
  }

  async findClassIdByLessonId(lessonId: string): Promise<string | null> {
    // Try to find as ClassLesson (UUID)
    const classLesson = await prisma.classLesson.findUnique({
      where: { id: lessonId },
      select: {
        classId: true,
      },
    });

    if (classLesson?.classId) {
      return classLesson.classId;
    }

    return null;
  }

  async findByRecipeId(recipeId: string): Promise<ClassLessonEntity[]> {
    const lessons = await prisma.classLesson.findMany({
      where: { recipeId },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            expectedDurationMinutes: true,
            steps: { select: { id: true, order: true, script: true } },
          },
        },
      },
    });
    return lessons.map(mapPrismaToClassLessonEntity);
  }

  async findByUserId(userId: string): Promise<ClassLessonEntity[]> {
    const lessons = await prisma.classLesson.findMany({
      where: {
        class: {
          tutorId: userId,
        },
      },
      include: {
        recipe: {
          select: {
            id: true,
            title: true,
            expectedDurationMinutes: true,
            steps: { select: { id: true, order: true, script: true } },
          },
        },
      },
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
    if (lessonData.title !== undefined) updateData.title = lessonData.title;

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
    if (lessonIds.length === 0) return;

    // Atomic three-pass reorder (same proven pattern as PrismaRecipeRepository
    // .reorderSteps), constraint-safe under @@unique([classId, order]):
    //
    //   Pass 1: listed lessons are lifted to temporary orders (in the desired
    //           sequence), freeing positions 0..n-1.
    //   Pass 2: unlisted lessons take their final positions n..m — no conflict,
    //           since the listed ones now sit above every final position. This
    //           also fixes a latent bug of the previous two-phase swap: lessons
    //           not included in `lessonIds` kept stale orders that could collide
    //           with the re-anchored ones and abort the whole transaction.
    //   Pass 3: listed lessons settle into their final positions 0..n-1.
    //
    // Membership is validated INSIDE the transaction, closing the
    // check-then-write race against concurrent lesson adds/deletes.
    await prisma.$transaction(async (tx) => {
      const all = await tx.classLesson.findMany({
        where: { classId },
        select: { id: true },
        orderBy: { order: 'asc' },
      });
      const knownIds = new Set(all.map((l) => l.id));
      for (const id of lessonIds) {
        if (!knownIds.has(id)) throw new LessonNotFoundError(id);
      }

      const listedOrder = new Map<string, number>();
      for (const [index, id] of lessonIds.entries()) {
        if (!listedOrder.has(id)) listedOrder.set(id, index);
      }
      const unlistedIds = all.filter((l) => !listedOrder.has(l.id)).map((l) => l.id);

      const TEMP_OFFSET = all.length;
      for (const [index, id] of lessonIds.entries()) {
        await tx.classLesson.update({
          where: { id, classId },
          data: { order: TEMP_OFFSET + index },
        });
      }
      for (const [index, id] of unlistedIds.entries()) {
        await tx.classLesson.update({
          where: { id, classId },
          data: { order: lessonIds.length + index },
        });
      }
      for (const [index, id] of lessonIds.entries()) {
        await tx.classLesson.update({
          where: { id, classId },
          data: { order: index },
        });
      }
    });
  }
}
