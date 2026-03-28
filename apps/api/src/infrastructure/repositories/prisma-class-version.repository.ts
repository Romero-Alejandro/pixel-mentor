/**
 * Prisma-based ClassVersion Repository.
 *
 * Implements IClassVersionRepository using Prisma ORM.
 * Handles all database operations for ClassVersion entities.
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';
import type { IClassVersionRepository } from '@/domain/repositories/class.repository.js';
import type {
  ClassVersionEntity,
  ClassVersionLessonEntity,
} from '@/domain/entities/class.entity.js';

/**
 * Maps Prisma ClassVersion to ClassVersionEntity
 * Handles mismatch between Prisma model (no createdAt) and entity (has createdAt)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClassVersionEntity(prismaVersion: any): ClassVersionEntity {
  return {
    id: prismaVersion.id,
    classId: prismaVersion.classId,
    version: prismaVersion.version,
    publishedAt: prismaVersion.publishedAt ?? undefined,
    isPublished: prismaVersion.isPublished,
    title: prismaVersion.title,
    description: prismaVersion.description ?? undefined,
    slug: prismaVersion.slug,
    status: prismaVersion.status,
    // Prisma model doesn't have createdAt, so we use publishedAt as fallback
    createdAt: prismaVersion.publishedAt ?? new Date(),
    lessons: prismaVersion.lessons
      ? prismaVersion.lessons.map(
          (l: {
            id: string;
            classVersionId: string;
            recipeId: string | null;
            order: number;
            title: string;
            duration: number | null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recipeSnapshot: any;
            createdAt: Date;
          }): ClassVersionLessonEntity => ({
            id: l.id,
            classVersionId: l.classVersionId,
            recipeId: l.recipeId ?? undefined,
            order: l.order,
            title: l.title,
            duration: l.duration ?? undefined,
            recipeSnapshot: l.recipeSnapshot ?? undefined,
            createdAt: l.createdAt,
          }),
        )
      : undefined,
  };
}

export class PrismaClassVersionRepository implements IClassVersionRepository {
  /**
   * Find a version by its unique ID
   */
  async findById(id: string): Promise<ClassVersionEntity | null> {
    const version = await prisma.classVersion.findUnique({
      where: { id },
      include: {
        lessons: true,
      },
    });

    if (!version) {
      return null;
    }

    return toClassVersionEntity(version);
  }

  /**
   * Find all versions for a specific class
   */
  async findByClassId(classId: string): Promise<ClassVersionEntity[]> {
    const versions = await prisma.classVersion.findMany({
      where: { classId },
      include: {
        lessons: true,
      },
    });

    return versions.map(toClassVersionEntity);
  }

  /**
   * Find a published version by its slug
   */
  async findBySlug(slug: string): Promise<ClassVersionEntity | null> {
    const version = await prisma.classVersion.findFirst({
      where: { slug, isPublished: true },
      include: {
        lessons: true,
      },
    });

    if (!version) {
      return null;
    }

    return toClassVersionEntity(version);
  }

  /**
   * Create a new class version (snapshot)
   */
  async create(
    versionData: Omit<ClassVersionEntity, 'id' | 'createdAt'>,
  ): Promise<ClassVersionEntity> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lessonsData: any =
      versionData.lessons?.map((lesson) => ({
        recipeId: lesson.recipeId,
        order: lesson.order,
        title: lesson.title,
        duration: lesson.duration,
        recipeSnapshot: lesson.recipeSnapshot ?? undefined,
      })) ?? undefined;

    const created = await prisma.classVersion.create({
      data: {
        classId: versionData.classId,
        version: versionData.version,
        publishedAt: versionData.publishedAt,
        isPublished: versionData.isPublished,
        title: versionData.title,
        description: versionData.description,
        slug: versionData.slug,
        status: versionData.status,
        lessons: lessonsData ? { create: lessonsData } : undefined,
      },
      include: {
        lessons: true,
      },
    });

    return toClassVersionEntity(created as unknown as Parameters<typeof toClassVersionEntity>[0]);
  }

  /**
   * Publish a class version (mark as published)
   */
  async publish(id: string): Promise<ClassVersionEntity> {
    const updated = await prisma.classVersion.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        status: 'PUBLISHED',
      },
      include: {
        lessons: true,
      },
    });

    return toClassVersionEntity(updated as unknown as Parameters<typeof toClassVersionEntity>[0]);
  }
}
