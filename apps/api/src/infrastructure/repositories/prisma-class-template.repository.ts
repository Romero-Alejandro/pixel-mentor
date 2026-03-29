/**
 * Prisma-based ClassTemplate Repository.
 *
 * Implements IClassTemplateRepository using Prisma ORM.
 * Extends PrismaBaseRepository for common CRUD operations.
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';
import type { IClassTemplateRepository } from '@/domain/repositories/class.repository.js';
import type { ClassTemplateEntity } from '@/domain/entities/class.entity.js';
import { PrismaBaseRepository } from './prisma-base.repository.js';

/**
 * Maps Prisma ClassTemplate model to ClassTemplateEntity
 */
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

type PrismaClassTemplate = {
  id: string;
  name: string;
  description: string | null;
  tutorId: string;
  createdAt: Date;
  updatedAt: Date;
};

type CreateTemplateInput = Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateTemplateInput = Partial<Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>>;

export class PrismaClassTemplateRepository
  extends PrismaBaseRepository<
    ClassTemplateEntity,
    PrismaClassTemplate,
    CreateTemplateInput,
    UpdateTemplateInput
  >
  implements IClassTemplateRepository
{
  constructor() {
    super(prisma.classTemplate as any, mapPrismaToClassTemplateEntity);
  }

  /**
   * Find all templates for a specific tutor
   */
  async findByTutorId(tutorId: string): Promise<ClassTemplateEntity[]> {
    return this.findAll({
      where: { tutorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new template
   * Override to handle field mapping
   */
  async create(templateData: CreateTemplateInput): Promise<ClassTemplateEntity> {
    const data = {
      name: templateData.name,
      description: templateData.description,
      tutorId: templateData.tutorId,
    };

    return super.create(data as any);
  }

  /**
   * Update an existing template
   * Override to handle field mapping
   */
  async update(id: string, templateData: UpdateTemplateInput): Promise<ClassTemplateEntity> {
    const updateData = this.prepareUpdateData({
      name: templateData.name,
      description: templateData.description,
      tutorId: templateData.tutorId,
    });

    return super.update(id, updateData as any);
  }
}
