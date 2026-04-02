/**
 * Class Template Application Service
 */

import type {
  IClassTemplateRepository,
  IClassRepository,
} from '@/features/class/domain/ports/class.repository.port';
import type { ClassTemplateEntity } from '@/features/class/domain/entities/class.entity';

// DTOs
export interface CreateTemplateInput {
  name: string;
  description?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
}

export interface CreateClassFromTemplateInput {
  title?: string;
  description?: string;
}

// Errors
export class TemplateNotFoundError extends Error {
  readonly code = 'TEMPLATE_NOT_FOUND' as const;
  readonly templateId: string;

  constructor(templateId: string) {
    super(`Template with ID ${templateId} not found`);
    this.name = 'TemplateNotFoundError';
    this.templateId = templateId;
  }
}

export class TemplateOwnershipError extends Error {
  readonly code = 'TEMPLATE_OWNERSHIP_ERROR' as const;
  readonly templateId: string;
  readonly userId: string;

  constructor(templateId: string, userId: string) {
    super(`Template ${templateId} does not belong to user ${userId}`);
    this.name = 'TemplateOwnershipError';
    this.templateId = templateId;
    this.userId = userId;
  }
}

// Template Service
export class ClassTemplateService {
  constructor(
    private templateRepo: IClassTemplateRepository,
    private classRepo: IClassRepository,
  ) {}

  async createTemplate(tutorId: string, data: CreateTemplateInput): Promise<ClassTemplateEntity> {
    return this.templateRepo.create({
      name: data.name,
      description: data.description,
      tutorId,
    });
  }

  async getTemplate(id: string): Promise<ClassTemplateEntity> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }
    return template;
  }

  async listTemplates(tutorId: string): Promise<ClassTemplateEntity[]> {
    return this.templateRepo.findByTutorId(tutorId);
  }

  async updateTemplate(
    id: string,
    tutorId: string,
    data: UpdateTemplateInput,
  ): Promise<ClassTemplateEntity> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    if (template.tutorId !== tutorId) {
      throw new TemplateOwnershipError(id, tutorId);
    }

    return this.templateRepo.update(id, {
      name: data.name,
      description: data.description,
    });
  }

  async deleteTemplate(id: string, tutorId: string): Promise<void> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    if (template.tutorId !== tutorId) {
      throw new TemplateOwnershipError(id, tutorId);
    }

    const classesResult = await this.classRepo.findByTutorId(tutorId, {});
    const classesFromTemplate = classesResult.classes.filter((c) => c.classTemplateId === id);

    if (classesFromTemplate.length > 0) {
      const nonDraftClasses = classesFromTemplate.filter((c) => c.status !== 'DRAFT');
      if (nonDraftClasses.length > 0) {
        throw new Error(
          `Cannot delete template: ${nonDraftClasses.length} class(es) created from this template have been published`,
        );
      }
    }

    await this.templateRepo.delete(id);
  }

  async createClassFromTemplate(
    templateId: string,
    tutorId: string,
    data?: CreateClassFromTemplateInput,
  ): Promise<{ classId: string; title: string }> {
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    if (template.tutorId !== tutorId) {
      throw new TemplateOwnershipError(templateId, tutorId);
    }

    const classEntity = await this.classRepo.create({
      title: data?.title ?? template.name,
      description: data?.description ?? template.description,
      tutorId,
      classTemplateId: templateId,
      status: 'DRAFT',
      version: 0,
    });

    return {
      classId: classEntity.id,
      title: classEntity.title,
    };
  }
}
