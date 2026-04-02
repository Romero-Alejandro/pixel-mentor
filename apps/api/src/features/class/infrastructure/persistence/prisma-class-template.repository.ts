/**
 * Prisma-based ClassTemplate Repository.
 */

import { prisma } from '@/database/client.js';
import type { IClassTemplateRepository } from '../../domain/ports/class.repository.port';
import type { ClassTemplateEntity } from '../../domain/entities/class.entity';

function mapPrismaToClassTemplateEntity(prismaTemplate: {
  id: string;
  name: string;
  description: string | null;
  tutorId: string;
  createdAt: Date;
  updatedAt: Date;
}): ClassTemplateEntity {
  return {
    id: prismaTemplate.id,
    name: prismaTemplate.name,
    description: prismaTemplate.description ?? undefined,
    tutorId: prismaTemplate.tutorId,
    createdAt: prismaTemplate.createdAt,
    updatedAt: prismaTemplate.updatedAt,
  };
}

export class PrismaClassTemplateRepository implements IClassTemplateRepository {
  async findById(id: string): Promise<ClassTemplateEntity | null> {
    const template = await prisma.classTemplate.findUnique({ where: { id } });
    if (!template) return null;
    return mapPrismaToClassTemplateEntity(template);
  }

  async findByTutorId(tutorId: string): Promise<ClassTemplateEntity[]> {
    const templates = await prisma.classTemplate.findMany({
      where: { tutorId },
      orderBy: { createdAt: 'desc' },
    });
    return templates.map(mapPrismaToClassTemplateEntity);
  }

  async create(
    templateData: Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassTemplateEntity> {
    const created = await prisma.classTemplate.create({
      data: {
        name: templateData.name,
        description: templateData.description,
        tutorId: templateData.tutorId,
      },
    });
    return mapPrismaToClassTemplateEntity(created);
  }

  async update(
    id: string,
    templateData: Partial<Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassTemplateEntity> {
    const updateData: Record<string, unknown> = {};
    if (templateData.name !== undefined) updateData.name = templateData.name;
    if (templateData.description !== undefined) updateData.description = templateData.description;

    const updated = await prisma.classTemplate.update({
      where: { id },
      data: updateData,
    });
    return mapPrismaToClassTemplateEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.classTemplate.delete({ where: { id } });
  }
}
