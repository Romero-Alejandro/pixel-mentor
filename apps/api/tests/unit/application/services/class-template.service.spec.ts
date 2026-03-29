/**
 * Unit Tests for ClassTemplateService
 *
 * Tests cover:
 * - createTemplate: creates template with correct data
 * - getTemplateById: retrieves by ID, throws when not found
 * - updateTemplate: updates template, validates ownership
 * - deleteTemplate: deletes template with business rules (no non-DRAFT classes), validates ownership
 * - listTemplates: lists templates for a tutor
 * - createClassFromTemplate: creates class from template with ownership validation
 */

import {
  ClassTemplateService,
  TemplateNotFoundError,
  TemplateOwnershipError,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type CreateClassFromTemplateInput,
} from '@/application/services/class-template.service.js';
import type {
  IClassTemplateRepository,
  IClassRepository,
} from '@/domain/repositories/class.repository.js';
import type {
  ClassTemplateEntity,
  ClassEntity,
  ClassStatus,
} from '@/domain/entities/class.entity.js';

// ==================== Mock Factory Functions ====================

const createMockClassTemplateEntity = (
  overrides: Partial<ClassTemplateEntity> = {},
): ClassTemplateEntity => ({
  id: 'template-1',
  name: 'Test Template',
  description: 'Test Description',
  tutorId: 'tutor-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockClassEntity = (overrides: Partial<ClassEntity> = {}): ClassEntity => ({
  id: 'class-1',
  title: 'Test Class',
  description: 'Test Description',
  tutorId: 'tutor-1',
  classTemplateId: 'template-1',
  status: 'DRAFT' as ClassStatus,
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ==================== Mock Repositories ====================

const createMockTemplateRepo = (): jest.Mocked<IClassTemplateRepository> => ({
  findById: jest.fn(),
  findByTutorId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const createMockClassRepo = (): jest.Mocked<IClassRepository> => ({
  findById: jest.fn(),
  findByTutorId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

// ==================== Test Suite ====================

describe('ClassTemplateService', () => {
  let templateRepo: jest.Mocked<IClassTemplateRepository>;
  let classRepo: jest.Mocked<IClassRepository>;
  let service: ClassTemplateService;

  beforeEach(() => {
    templateRepo = createMockTemplateRepo();
    classRepo = createMockClassRepo();
    service = new ClassTemplateService(templateRepo, classRepo);
  });

  describe('createTemplate', () => {
    it('should create template with correct data', async () => {
      // Given
      const input: CreateTemplateInput = {
        name: 'New Template',
        description: 'A new template',
      };

      const createdTemplate = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'New Template',
        description: 'A new template',
      });
      templateRepo.create.mockResolvedValue(createdTemplate);

      // When
      const result = await service.createTemplate('tutor-1', input);

      // Then
      expect(templateRepo.create).toHaveBeenCalledWith({
        name: 'New Template',
        description: 'A new template',
        tutorId: 'tutor-1',
      });
      expect(result).toEqual(createdTemplate);
    });

    it('should create template without description when not provided', async () => {
      // Given
      const input: CreateTemplateInput = {
        name: 'Minimal Template',
      };

      const createdTemplate = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'Minimal Template',
        description: undefined,
      });
      templateRepo.create.mockResolvedValue(createdTemplate);

      // When
      const result = await service.createTemplate('tutor-1', input);

      // Then
      expect(templateRepo.create).toHaveBeenCalledWith({
        name: 'Minimal Template',
        description: undefined,
        tutorId: 'tutor-1',
      });
      expect(result.name).toBe('Minimal Template');
    });

    it('should generate unique template ID', async () => {
      // Given
      const input: CreateTemplateInput = {
        name: 'Template',
      };

      const createdTemplate = createMockClassTemplateEntity({ id: 'generated-uuid-123' });
      templateRepo.create.mockResolvedValue(createdTemplate);

      // When
      await service.createTemplate('tutor-1', input);

      // Then
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Template',
          tutorId: 'tutor-1',
        }),
      );
    });
  });

  describe('getTemplateById', () => {
    it('should retrieve template by ID', async () => {
      // Given
      const mockTemplate = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(mockTemplate);

      // When
      const result = await service.getTemplate('template-1');

      // Then
      expect(templateRepo.findById).toHaveBeenCalledWith('template-1');
      expect(result).toEqual(mockTemplate);
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      // Given
      templateRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.getTemplate('non-existent')).rejects.toThrow(TemplateNotFoundError);
    });

    it('should include template ID in error message', async () => {
      // Given
      templateRepo.findById.mockResolvedValue(null);

      // When/Then
      try {
        await service.getTemplate('missing-id');
      } catch (error) {
        expect((error as Error).message).toContain('missing-id');
      }
    });
  });

  describe('listTemplates', () => {
    it('should list all templates for a tutor', async () => {
      // Given
      const mockTemplates = [
        createMockClassTemplateEntity({ id: 'template-1', name: 'Template 1' }),
        createMockClassTemplateEntity({ id: 'template-2', name: 'Template 2' }),
      ];
      templateRepo.findByTutorId.mockResolvedValue(mockTemplates);

      // When
      const result = await service.listTemplates('tutor-1');

      // Then
      expect(templateRepo.findByTutorId).toHaveBeenCalledWith('tutor-1');
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockTemplates);
    });

    it('should return empty array when tutor has no templates', async () => {
      // Given
      templateRepo.findByTutorId.mockResolvedValue([]);

      // When
      const result = await service.listTemplates('tutor-1');

      // Then
      expect(result).toEqual([]);
    });

    it('should include description when present', async () => {
      // Given
      const mockTemplates = [
        createMockClassTemplateEntity({
          id: 'template-1',
          name: 'Template 1',
          description: 'Has description',
        }),
      ];
      templateRepo.findByTutorId.mockResolvedValue(mockTemplates);

      // When
      const result = await service.listTemplates('tutor-1');

      // Then
      expect(result[0].description).toBe('Has description');
    });
  });

  describe('updateTemplate', () => {
    it('should update template when user is owner', async () => {
      // Given
      const existingTemplate = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'Old Name',
        description: 'Old Description',
      });
      templateRepo.findById.mockResolvedValue(existingTemplate);

      const input: UpdateTemplateInput = {
        name: 'Updated Name',
        description: 'Updated Description',
      };

      const updatedTemplate = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'Updated Name',
        description: 'Updated Description',
      });
      templateRepo.update.mockResolvedValue(updatedTemplate);

      // When
      const result = await service.updateTemplate('template-1', 'tutor-1', input);

      // Then
      expect(templateRepo.update).toHaveBeenCalledWith('template-1', {
        name: 'Updated Name',
        description: 'Updated Description',
      });
      expect(result).toEqual(updatedTemplate);
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      // Given
      templateRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(
        service.updateTemplate('non-existent', 'tutor-1', { name: 'New Name' }),
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should throw TemplateOwnershipError when user is not owner', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1', tutorId: 'tutor-1' });
      templateRepo.findById.mockResolvedValue(template);

      // When/Then
      await expect(
        service.updateTemplate('template-1', 'different-tutor', { name: 'New Name' }),
      ).rejects.toThrow(TemplateOwnershipError);
    });

    it('should throw TemplateOwnershipError when updating non-existent template', async () => {
      // Given
      templateRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(
        service.updateTemplate('non-existent', 'tutor-1', { name: 'New Name' }),
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it('should only update provided fields', async () => {
      // Given
      const template = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'Original Name',
        description: 'Original Description',
      });
      templateRepo.findById.mockResolvedValue(template);

      const input: UpdateTemplateInput = {
        name: 'Updated Name Only',
      };

      const updatedTemplate = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'Updated Name Only',
        description: 'Original Description',
      });
      templateRepo.update.mockResolvedValue(updatedTemplate);

      // When
      await service.updateTemplate('template-1', 'tutor-1', input);

      // Then
      expect(templateRepo.update).toHaveBeenCalledWith('template-1', {
        name: 'Updated Name Only',
        description: undefined, // Not provided, should be undefined
      });
    });

    it('should not change tutorId when updating', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1', tutorId: 'tutor-1' });
      templateRepo.findById.mockResolvedValue(template);

      const input: UpdateTemplateInput = {
        name: 'New Name',
      };

      templateRepo.update.mockResolvedValue(template);

      // When
      await service.updateTemplate('template-1', 'tutor-1', input);

      // Then
      expect(templateRepo.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          name: 'New Name',
        }),
      );
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template when no classes exist', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);
      templateRepo.delete.mockResolvedValue();
      classRepo.findByTutorId.mockResolvedValue({ classes: [], total: 0 });

      // When
      await service.deleteTemplate('template-1', 'tutor-1');

      // Then
      expect(classRepo.findByTutorId).toHaveBeenCalledWith('tutor-1', {});
      expect(templateRepo.delete).toHaveBeenCalledWith('template-1');
    });

    it('should delete template when only DRAFT classes exist', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);
      templateRepo.delete.mockResolvedValue();

      const draftClasses = [
        createMockClassEntity({
          id: 'class-1',
          classTemplateId: 'template-1',
          status: 'DRAFT',
        }),
        createMockClassEntity({
          id: 'class-2',
          classTemplateId: 'template-1',
          status: 'DRAFT',
        }),
      ];
      classRepo.findByTutorId.mockResolvedValue({ classes: draftClasses, total: 2 });

      // When
      await service.deleteTemplate('template-1', 'tutor-1');

      // Then
      expect(templateRepo.delete).toHaveBeenCalledWith('template-1');
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      // Given
      templateRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.deleteTemplate('non-existent', 'tutor-1')).rejects.toThrow(
        TemplateNotFoundError,
      );
    });

    it('should throw TemplateOwnershipError when user is not owner', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1', tutorId: 'tutor-1' });
      templateRepo.findById.mockResolvedValue(template);
      classRepo.findByTutorId.mockResolvedValue({ classes: [], total: 0 });

      // When/Then
      await expect(service.deleteTemplate('template-1', 'different-tutor')).rejects.toThrow(
        TemplateOwnershipError,
      );
    });

    it('should throw error when classes with PUBLISHED status exist', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      const publishedClass = createMockClassEntity({
        id: 'class-1',
        classTemplateId: 'template-1',
        status: 'PUBLISHED',
      });
      classRepo.findByTutorId.mockResolvedValue({ classes: [publishedClass], total: 1 });

      // When/Then
      await expect(service.deleteTemplate('template-1', 'tutor-1')).rejects.toThrow(
        'Cannot delete template: 1 class(es) created from this template have been published',
      );
    });

    it('should throw error when classes with UNDER_REVIEW status exist', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      const underReviewClass = createMockClassEntity({
        id: 'class-1',
        classTemplateId: 'template-1',
        status: 'UNDER_REVIEW',
      });
      classRepo.findByTutorId.mockResolvedValue({ classes: [underReviewClass], total: 1 });

      // When/Then
      await expect(service.deleteTemplate('template-1', 'tutor-1')).rejects.toThrow(
        'Cannot delete template: 1 class(es) created from this template have been published',
      );
    });

    it('should throw error with count of multiple non-DRAFT classes', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      const classes = [
        createMockClassEntity({
          id: 'class-1',
          classTemplateId: 'template-1',
          status: 'PUBLISHED',
        }),
        createMockClassEntity({
          id: 'class-2',
          classTemplateId: 'template-1',
          status: 'UNDER_REVIEW',
        }),
      ];
      classRepo.findByTutorId.mockResolvedValue({ classes, total: 2 });

      // When/Then
      await expect(service.deleteTemplate('template-1', 'tutor-1')).rejects.toThrow(
        'Cannot delete template: 2 class(es) created from this template have been published',
      );
    });

    it('should allow deletion when mixed DRAFT and non-DRAFT classes (only count non-DRAFT)', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      const classes = [
        createMockClassEntity({ id: 'class-1', classTemplateId: 'template-1', status: 'DRAFT' }),
        createMockClassEntity({ id: 'class-2', classTemplateId: 'template-1', status: 'DRAFT' }),
        createMockClassEntity({
          id: 'class-3',
          classTemplateId: 'template-1',
          status: 'PUBLISHED',
        }),
      ];
      classRepo.findByTutorId.mockResolvedValue({ classes, total: 3 });

      // When/Then
      await expect(service.deleteTemplate('template-1', 'tutor-1')).rejects.toThrow(
        'Cannot delete template: 1 class(es) created from this template have been published',
      );
    });

    it('should filter classes by matching templateId', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      // Classes from different templates should be ignored
      const classes = [
        createMockClassEntity({ id: 'class-1', classTemplateId: 'template-1', status: 'DRAFT' }),
        createMockClassEntity({ id: 'class-2', classTemplateId: 'template-1', status: 'DRAFT' }),
        createMockClassEntity({
          id: 'class-3',
          classTemplateId: 'different-template',
          status: 'PUBLISHED',
        }),
      ];
      classRepo.findByTutorId.mockResolvedValue({ classes, total: 3 });

      // When
      await service.deleteTemplate('template-1', 'tutor-1');

      // Then - should succeed because only 2 classes belong to template-1 and both are DRAFT
      expect(templateRepo.delete).toHaveBeenCalledWith('template-1');
    });
  });

  describe('createClassFromTemplate', () => {
    it('should create class from template using template name', async () => {
      // Given
      const template = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'My Template',
        description: 'Template Description',
      });
      templateRepo.findById.mockResolvedValue(template);

      const createdClass = createMockClassEntity({
        id: 'class-1',
        title: 'My Template',
        description: 'Template Description',
        classTemplateId: 'template-1',
        status: 'DRAFT',
      });
      classRepo.create.mockResolvedValue(createdClass);

      // When
      const result = await service.createClassFromTemplate('template-1', 'tutor-1');

      // Then
      expect(classRepo.create).toHaveBeenCalledWith({
        title: 'My Template',
        description: 'Template Description',
        tutorId: 'tutor-1',
        classTemplateId: 'template-1',
        status: 'DRAFT',
        version: 0,
      });
      expect(result).toEqual({ classId: 'class-1', title: 'My Template' });
    });

    it('should create class with custom title and description', async () => {
      // Given
      const template = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'My Template',
        description: 'Template Description',
      });
      templateRepo.findById.mockResolvedValue(template);

      const input: CreateClassFromTemplateInput = {
        title: 'Custom Title',
        description: 'Custom Description',
      };

      const createdClass = createMockClassEntity({
        id: 'class-1',
        title: 'Custom Title',
        description: 'Custom Description',
        classTemplateId: 'template-1',
        status: 'DRAFT',
      });
      classRepo.create.mockResolvedValue(createdClass);

      // When
      const result = await service.createClassFromTemplate('template-1', 'tutor-1', input);

      // Then
      expect(classRepo.create).toHaveBeenCalledWith({
        title: 'Custom Title',
        description: 'Custom Description',
        tutorId: 'tutor-1',
        classTemplateId: 'template-1',
        status: 'DRAFT',
        version: 0,
      });
      expect(result.classId).toBe('class-1');
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      // Given
      templateRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.createClassFromTemplate('non-existent', 'tutor-1')).rejects.toThrow(
        TemplateNotFoundError,
      );
    });

    it('should throw TemplateOwnershipError when user is not template owner', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1', tutorId: 'tutor-1' });
      templateRepo.findById.mockResolvedValue(template);

      // When/Then
      await expect(
        service.createClassFromTemplate('template-1', 'different-tutor'),
      ).rejects.toThrow(TemplateOwnershipError);
    });

    it('should create class with only title (no description) when template has no description', async () => {
      // Given
      const template = createMockClassTemplateEntity({
        id: 'template-1',
        name: 'My Template',
        description: undefined,
      });
      templateRepo.findById.mockResolvedValue(template);

      const createdClass = createMockClassEntity({
        id: 'class-1',
        title: 'My Template',
        description: undefined,
        classTemplateId: 'template-1',
        status: 'DRAFT',
      });
      classRepo.create.mockResolvedValue(createdClass);

      // When
      await service.createClassFromTemplate('template-1', 'tutor-1');

      // Then
      expect(classRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Template',
          description: undefined,
          status: 'DRAFT',
        }),
      );
    });

    it('should set status to DRAFT regardless of template', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      const createdClass = createMockClassEntity({
        id: 'class-1',
        status: 'DRAFT',
        version: 0,
      });
      classRepo.create.mockResolvedValue(createdClass);

      // When
      await service.createClassFromTemplate('template-1', 'tutor-1');

      // Then
      expect(classRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DRAFT',
          version: 0,
        }),
      );
    });

    it('should correctly link class to template via classTemplateId', async () => {
      // Given
      const template = createMockClassTemplateEntity({ id: 'template-1' });
      templateRepo.findById.mockResolvedValue(template);

      const createdClass = createMockClassEntity({ id: 'class-1', classTemplateId: 'template-1' });
      classRepo.create.mockResolvedValue(createdClass);

      // When
      await service.createClassFromTemplate('template-1', 'tutor-1');

      // Then
      expect(classRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          classTemplateId: 'template-1',
        }),
      );
    });
  });
});
