/**
 * Class Template Application Service
 *
 * Manages class templates which are reusable blueprints for creating classes.
 * Supports CRUD operations and creating classes from templates.
 */

import type {
  IClassTemplateRepository,
  IClassRepository,
} from '@/domain/repositories/class.repository.js';
import type { ClassTemplateEntity } from '@/domain/entities/class.entity.js';

// ==================== Error Classes ====================

export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Template not found: ${templateId}`);
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateOwnershipError extends Error {
  constructor(templateId: string, tutorId: string) {
    super(`User ${tutorId} does not have permission to modify template ${templateId}`);
    this.name = 'TemplateOwnershipError';
  }
}

// ==================== DTOs ====================

export interface CreateTemplateInput {
  name: string;
  description?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
}

export interface CreateClassFromTemplateInput {
  title?: string; // If not provided, uses template name
  description?: string;
}

// ==================== Template Service ====================

export class ClassTemplateService {
  constructor(
    private templateRepo: IClassTemplateRepository,
    private classRepo: IClassRepository,
  ) {}

  /**
   * Create a new template
   */
  async createTemplate(tutorId: string, data: CreateTemplateInput): Promise<ClassTemplateEntity> {
    const template = await this.templateRepo.create({
      name: data.name,
      description: data.description,
      tutorId,
    });

    return template;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<ClassTemplateEntity> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    return template;
  }

  /**
   * List all templates for a tutor
   */
  async listTemplates(tutorId: string): Promise<ClassTemplateEntity[]> {
    const templates = await this.templateRepo.findByTutorId(tutorId);
    return templates;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    id: string,
    tutorId: string,
    data: UpdateTemplateInput,
  ): Promise<ClassTemplateEntity> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    // Check ownership
    if (template.tutorId !== tutorId) {
      throw new TemplateOwnershipError(id, tutorId);
    }

    // Update template
    const updated = await this.templateRepo.update(id, {
      name: data.name,
      description: data.description,
    });

    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string, tutorId: string): Promise<void> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    // Check ownership
    if (template.tutorId !== tutorId) {
      throw new TemplateOwnershipError(id, tutorId);
    }

    // Check if there are any classes created from this template
    const classesResult = await this.classRepo.findByTutorId(tutorId, {});
    const classesFromTemplate = classesResult.classes.filter((c) => c.classTemplateId === id);

    if (classesFromTemplate.length > 0) {
      // Check if any of these classes are not in DRAFT status
      const nonDraftClasses = classesFromTemplate.filter((c) => c.status !== 'DRAFT');

      if (nonDraftClasses.length > 0) {
        throw new Error(
          `Cannot delete template: ${nonDraftClasses.length} class(es) created from this template have been published`,
        );
      }
    }

    await this.templateRepo.delete(id);
  }

  /**
   * Create a new Class from a template
   * The new class starts in DRAFT status and can be edited by the tutor
   */
  async createClassFromTemplate(
    templateId: string,
    tutorId: string,
    data?: CreateClassFromTemplateInput,
  ): Promise<{ classId: string; title: string }> {
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    // Check ownership
    if (template.tutorId !== tutorId) {
      throw new TemplateOwnershipError(templateId, tutorId);
    }

    // Create class from template
    // Note: Currently templates don't store lessons, but this could be extended
    // For now, the class is created with template info but no lessons
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
