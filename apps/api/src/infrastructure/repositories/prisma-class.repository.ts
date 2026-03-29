/**
 * Prisma-based Class Repository.
 *
 * Implements IClassRepository using Prisma ORM.
 * Handles all database operations for Class entities.
 */

import type { IClassRepository } from '@/domain/repositories/class.repository.js';
import type { ClassEntity, ClassStatus } from '@/domain/entities/class.entity.js';
import { prisma } from '@/infrastructure/adapters/database/client.js';

/**
 * Maps Prisma Class model to ClassEntity
 */
function mapPrismaToClassEntity(prismaClass: {
  id: string;
  title: string;
  description: string | null;
  tutorId: string;
  classTemplateId: string | null;
  currentVersionId: string | null;
  status: ClassStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lessons?: Array<{
    id: string;
    classId: string;
    recipeId: string | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
    recipe?: {
      id: string;
      title: string;
      expectedDurationMinutes: number | null;
    };
  }>;
  versions?: Array<{
    id: string;
    classId: string;
    version: string;
    publishedAt: Date | null;
    isPublished: boolean;
    title: string;
    description: string | null;
    slug: string;
    status: ClassStatus;
    createdAt: Date;
  }>;
  classTemplate?: {
    id: string;
    name: string;
    description: string | null;
    tutorId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}): ClassEntity {
  return {
    id: prismaClass.id,
    title: prismaClass.title,
    description: prismaClass.description ?? undefined,
    tutorId: prismaClass.tutorId,
    classTemplateId: prismaClass.classTemplateId ?? undefined,
    currentVersionId: prismaClass.currentVersionId ?? undefined,
    status: prismaClass.status,
    version: prismaClass.version,
    createdAt: prismaClass.createdAt,
    updatedAt: prismaClass.updatedAt,
    lessons: prismaClass.lessons?.map((lesson: any) => ({
      id: lesson.id,
      classId: lesson.classId,
      recipeId: lesson.recipeId,
      order: lesson.order,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
      recipe: lesson.recipe
        ? {
            id: lesson.recipe.id,
            title: lesson.recipe.title,
            expectedDurationMinutes: lesson.recipe.expectedDurationMinutes,
          }
        : undefined,
    })),
  };
}

export class PrismaClassRepository implements IClassRepository {
  /**
   * Find a class by its unique ID
   */
  async findById(id: string): Promise<ClassEntity | null> {
    const classEntity = await prisma.class.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!classEntity) {
      return null;
    }

    return mapPrismaToClassEntity(classEntity);
  }

  /**
   * Find all classes for a specific tutor with optional status filter and pagination
   */
  async findByTutorId(
    tutorId: string,
    options?: {
      status?: ClassStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ classes: ClassEntity[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tutorId,
      ...(options?.status && { status: options.status }),
    };

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            include: {
              recipe: {
                select: { id: true, title: true, expectedDurationMinutes: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.class.count({ where }),
    ]);

    return {
      classes: classes.map(mapPrismaToClassEntity),
      total,
    };
  }

  /**
   * Create a new class
   */
  async create(
    classData: Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassEntity> {
    const created = await prisma.class.create({
      data: {
        title: classData.title,
        description: classData.description,
        tutorId: classData.tutorId,
        classTemplateId: classData.classTemplateId,
        currentVersionId: classData.currentVersionId,
        status: classData.status,
        version: classData.version,
      },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return mapPrismaToClassEntity(created);
  }

  /**
   * Update an existing class
   */
  async update(
    id: string,
    classData: Partial<Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassEntity> {
    const updateData: Record<string, unknown> = {};

    if (classData.title !== undefined) {
      updateData.title = classData.title;
    }
    if (classData.description !== undefined) {
      updateData.description = classData.description;
    }
    if (classData.tutorId !== undefined) {
      updateData.tutorId = classData.tutorId;
    }
    if (classData.classTemplateId !== undefined) {
      updateData.classTemplateId = classData.classTemplateId;
    }
    if (classData.currentVersionId !== undefined) {
      updateData.currentVersionId = classData.currentVersionId;
    }
    if (classData.status !== undefined) {
      updateData.status = classData.status;
    }
    if (classData.version !== undefined) {
      updateData.version = classData.version;
    }

    const updated = await prisma.class.update({
      where: { id },
      data: updateData,
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return mapPrismaToClassEntity(updated);
  }

  /**
   * Delete a class by its ID
   */
  async delete(id: string): Promise<void> {
    await prisma.class.delete({
      where: { id },
    });
  }
}
