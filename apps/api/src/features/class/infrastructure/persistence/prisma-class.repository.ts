/**
 * Prisma-based Class Repository.
 */

import type { IClassRepository } from '../../domain/ports/class.repository.port';
import type { ClassEntity, ClassStatus } from '../../domain/entities/class.entity';

import { prisma } from '@/database/client.js';

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
    lessons: prismaClass.lessons?.map((lesson) => ({
      id: lesson.id,
      classId: lesson.classId,
      recipeId: lesson.recipeId!,
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
  async findById(id: string): Promise<ClassEntity | null> {
    const classEntity = await prisma.class.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
    });

    if (!classEntity) return null;
    return mapPrismaToClassEntity(classEntity);
  }

  async findByTutorId(
    tutorId: string,
    options?: { status?: ClassStatus; page?: number; limit?: number },
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
              recipe: { select: { id: true, title: true, expectedDurationMinutes: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.class.count({ where }),
    ]);

    return { classes: classes.map(mapPrismaToClassEntity), total };
  }

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
      include: { lessons: { orderBy: { order: 'asc' } } },
    });

    return mapPrismaToClassEntity(created);
  }

  async update(
    id: string,
    classData: Partial<Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassEntity> {
    const updateData: Record<string, unknown> = {};
    if (classData.title !== undefined) updateData.title = classData.title;
    if (classData.description !== undefined) updateData.description = classData.description;
    if (classData.tutorId !== undefined) updateData.tutorId = classData.tutorId;
    if (classData.classTemplateId !== undefined)
      updateData.classTemplateId = classData.classTemplateId;
    if (classData.currentVersionId !== undefined)
      updateData.currentVersionId = classData.currentVersionId;
    if (classData.status !== undefined) updateData.status = classData.status;
    if (classData.version !== undefined) updateData.version = classData.version;

    const updated = await prisma.class.update({
      where: { id },
      data: updateData,
      include: { lessons: { orderBy: { order: 'asc' } } },
    });

    return mapPrismaToClassEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.class.delete({ where: { id } });
  }
}
