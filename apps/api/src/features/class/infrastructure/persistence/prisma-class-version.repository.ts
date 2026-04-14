/**
 * Prisma-based ClassVersion Repository.
 */

import type { IClassVersionRepository } from '../../domain/ports/class.repository.port';
import type { ClassVersionEntity } from '../../domain/entities/class.entity';

import { prisma, type Prisma } from '@/database/client.js';

function toClassVersionEntity(prismaVersion: {
  id: string;
  classId: string;
  version: string;
  publishedAt: Date | null;
  isPublished: boolean;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  lessons?: Array<{
    id: string;
    classVersionId: string;
    recipeId: string | null;
    order: number;
    title: string;
    duration: number | null;
    recipeSnapshot: unknown;
    createdAt: Date;
  }>;
}): ClassVersionEntity {
  return {
    id: prismaVersion.id,
    classId: prismaVersion.classId,
    version: prismaVersion.version,
    publishedAt: prismaVersion.publishedAt ?? undefined,
    isPublished: prismaVersion.isPublished,
    title: prismaVersion.title,
    description: prismaVersion.description ?? undefined,
    slug: prismaVersion.slug,
    status: prismaVersion.status as ClassVersionEntity['status'],
    lessons: prismaVersion.lessons?.map((l) => ({
      id: l.id,
      classVersionId: l.classVersionId,
      recipeId: l.recipeId!,
      order: l.order,
      title: l.title!,
      duration: l.duration ?? undefined,
      recipeSnapshot: (l.recipeSnapshot as Record<string, unknown>) ?? undefined,
      createdAt: l.createdAt,
    })),
    createdAt: prismaVersion.publishedAt ?? new Date(),
  };
}

export class PrismaClassVersionRepository implements IClassVersionRepository {
  async findById(id: string): Promise<ClassVersionEntity | null> {
    const version = await prisma.classVersion.findUnique({
      where: { id },
      include: { lessons: { include: { recipe: true } } },
    });
    if (!version) return null;
    return toClassVersionEntity(version);
  }

  async findByClassId(classId: string): Promise<ClassVersionEntity[]> {
    const versions = await prisma.classVersion.findMany({
      where: { classId },
      include: { lessons: { include: { recipe: true } } },
    });
    return versions.map(toClassVersionEntity);
  }

  async findBySlug(slug: string): Promise<ClassVersionEntity | null> {
    const version = await prisma.classVersion.findFirst({
      where: { slug, isPublished: true },
      include: { lessons: { include: { recipe: true } } },
    });
    if (!version) return null;
    return toClassVersionEntity(version);
  }

  async create(
    versionData: Omit<ClassVersionEntity, 'id' | 'createdAt'>,
  ): Promise<ClassVersionEntity> {
    const lessonsData = versionData.lessons?.map((lesson) => ({
      recipeId: lesson.recipeId,
      order: lesson.order,
      title: lesson.title!,
      duration: lesson.duration ?? undefined,
      recipeSnapshot: (lesson.recipeSnapshot as Prisma.InputJsonValue) ?? undefined,
    }));

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
      include: { lessons: true },
    });

    return toClassVersionEntity(created);
  }

  async publish(id: string): Promise<ClassVersionEntity> {
    const updated = await prisma.classVersion.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date(), status: 'PUBLISHED' },
      include: { lessons: true },
    });
    return toClassVersionEntity(updated);
  }
}
