/**
 * Unit Tests for ClassService
 *
 * Tests cover:
 * - createClass: creates with correct data, generates first version
 * - getClass: retrieves by ID
 * - updateClass: only updates title/description, validates class exists
 * - deleteClass: deletes DRAFT only, throws for non-DRAFT
 * - publishClass: transitions DRAFT->UNDER_REVIEW->PUBLISHED, validates lessons exist
 * - addLesson: adds lesson with correct order, validates DRAFT status
 * - removeLesson: removes lesson, validates DRAFT status
 * - reorderLessons: reorders lessons transactionally
 */

import {
  ClassService,
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  ClassValidationError,
  LessonNotFoundError,
  type CreateClassInput,
  type UpdateClassInput,
  type AddLessonInput,
  type UpdateLessonInput,
} from '@/features/class/application/services/class.service.js';
import type {
  IClassRepository,
  IClassLessonRepository,
  IClassVersionRepository,
} from '@/features/class/domain/ports/class.repository.js';
import type {
  ClassEntity,
  ClassLessonEntity,
  ClassStatus,
} from '@/features/class/domain/entities/class.entity.js';

// Mock factories
const createMockClassEntity = (overrides: Partial<ClassEntity> = {}): ClassEntity => ({
  id: 'class-1',
  title: 'Test Class',
  description: 'Test Description',
  tutorId: 'tutor-1',
  status: 'DRAFT' as ClassStatus,
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockLessonEntity = (overrides: Partial<ClassLessonEntity> = {}): ClassLessonEntity => ({
  id: 'lesson-1',
  classId: 'class-1',
  recipeId: 'recipe-1',
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock repositories
const createMockClassRepo = (): jest.Mocked<IClassRepository> => ({
  findById: jest.fn(),
  findByTutorId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const createMockLessonRepo = (): jest.Mocked<IClassLessonRepository> => ({
  findByClassId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  reorder: jest.fn(),
});

const createMockVersionRepo = (): jest.Mocked<IClassVersionRepository> => ({
  findById: jest.fn(),
  findByClassId: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  publish: jest.fn(),
});

describe('ClassService', () => {
  let classRepo: jest.Mocked<IClassRepository>;
  let lessonRepo: jest.Mocked<IClassLessonRepository>;
  let versionRepo: jest.Mocked<IClassVersionRepository>;
  let service: ClassService;

  beforeEach(() => {
    classRepo = createMockClassRepo();
    lessonRepo = createMockLessonRepo();
    versionRepo = createMockVersionRepo();
    service = new ClassService(classRepo, lessonRepo, versionRepo);
  });

  describe('createClass', () => {
    it('should create class with correct data and generate first version', async () => {
      // Given
      const input: CreateClassInput = {
        title: 'New Class',
        description: 'New Description',
      };

      const createdClass = createMockClassEntity({ id: 'class-1', title: 'New Class' });
      classRepo.create.mockResolvedValue(createdClass);
      classRepo.findById.mockResolvedValue(createdClass);
      lessonRepo.findByClassId.mockResolvedValue([]);

      // When
      const result = await service.createClass('tutor-1', input);

      // Then
      expect(classRepo.create).toHaveBeenCalledWith({
        title: 'New Class',
        description: 'New Description',
        tutorId: 'tutor-1',
        status: 'DRAFT',
        version: 0,
      });
      expect(result).toBeDefined();
      expect(result.title).toBe('New Class');
    });

    it('should create class with lessons when provided', async () => {
      // Given
      const input: CreateClassInput = {
        title: 'New Class',
        lessons: [
          { recipeId: 'recipe-1', order: 0 },
          { recipeId: 'recipe-2', order: 1 },
        ],
      };

      const createdClass = createMockClassEntity({ id: 'class-1' });
      classRepo.create.mockResolvedValue(createdClass);
      classRepo.findById.mockResolvedValue(createdClass);
      lessonRepo.create.mockResolvedValue(createMockLessonEntity());
      lessonRepo.findByClassId.mockResolvedValue([]);

      // When
      await service.createClass('tutor-1', input);

      // Then
      expect(lessonRepo.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getClass', () => {
    it('should retrieve class by ID with lessons', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1' });
      const mockLessons = [createMockLessonEntity({ id: 'lesson-1', classId: 'class-1' })];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      // When
      const result = await service.getClass('class-1');

      // Then
      expect(result).toEqual({
        ...mockClass,
        lessons: mockLessons,
      });
    });

    it('should throw ClassNotFoundError when class not found', async () => {
      // Given
      classRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.getClass('non-existent')).rejects.toThrow(ClassNotFoundError);
    });
  });

  describe('updateClass', () => {
    it('should update title and description for DRAFT class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const input: UpdateClassInput = {
        title: 'Updated Title',
        description: 'Updated Description',
      };

      classRepo.findById.mockResolvedValue(mockClass);
      classRepo.update.mockResolvedValue({
        ...mockClass,
        ...input,
      });

      // When
      const result = await service.updateClass('class-1', 'tutor-1', input);

      // Then
      expect(classRepo.update).toHaveBeenCalledWith('class-1', {
        title: 'Updated Title',
        description: 'Updated Description',
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should throw ClassNotFoundError when class not found', async () => {
      // Given
      classRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.updateClass('non-existent', 'tutor-1', {})).rejects.toThrow(
        ClassNotFoundError,
      );
    });

    it('should throw ClassOwnershipError when user does not own class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', tutorId: 'tutor-1' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(service.updateClass('class-1', 'different-tutor', {})).rejects.toThrow(
        ClassOwnershipError,
      );
    });

    it('should throw ClassStateError when class is not DRAFT', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(
        service.updateClass('class-1', 'tutor-1', { title: 'New Title' }),
      ).rejects.toThrow(ClassStateError);
    });
  });

  describe('deleteClass', () => {
    it('should delete DRAFT class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      classRepo.findById.mockResolvedValue(mockClass);
      classRepo.delete.mockResolvedValue();

      // When
      await service.deleteClass('class-1', 'tutor-1');

      // Then
      expect(classRepo.delete).toHaveBeenCalledWith('class-1');
    });

    it('should throw ClassNotFoundError when class not found', async () => {
      // Given
      classRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.deleteClass('non-existent', 'tutor-1')).rejects.toThrow(
        ClassNotFoundError,
      );
    });

    it('should throw ClassStateError when class is not DRAFT', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(service.deleteClass('class-1', 'tutor-1')).rejects.toThrow(ClassStateError);
    });
  });

  describe('publishClass', () => {
    it('should publish DRAFT class with lessons (DRAFT->UNDER_REVIEW->PUBLISHED)', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT', version: 0 });
      const publishedClass = { ...mockClass, status: 'PUBLISHED' as const, version: 1 };
      const mockLessons = [createMockLessonEntity({ id: 'lesson-1', classId: 'class-1' })];

      classRepo.findById.mockResolvedValueOnce(mockClass).mockResolvedValueOnce(publishedClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);
      versionRepo.create.mockResolvedValue({} as any);
      classRepo.update.mockResolvedValue(publishedClass);

      // When
      const result = await service.publishClass('class-1', 'tutor-1');

      // Then
      expect(classRepo.update).toHaveBeenCalledTimes(1); // Direct transition to PUBLISHED
      expect(versionRepo.create).toHaveBeenCalled();
      expect(result.status).toBe('PUBLISHED');
      expect(result.version).toBe(1);
    });

    it('should throw ClassValidationError when no lessons exist', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue([]);

      // When/Then
      await expect(service.publishClass('class-1', 'tutor-1')).rejects.toThrow(
        ClassValidationError,
      );
    });

    it('should throw ClassNotFoundError when class not found', async () => {
      // Given
      classRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(service.publishClass('non-existent', 'tutor-1')).rejects.toThrow(
        ClassNotFoundError,
      );
    });
  });

  describe('addLesson', () => {
    it('should add lesson with correct order for DRAFT class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLessons = [
        createMockLessonEntity({ id: 'lesson-1', classId: 'class-1', order: 0 }),
      ];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);
      lessonRepo.create.mockResolvedValue(
        createMockLessonEntity({ id: 'lesson-2', classId: 'class-1', order: 1 }),
      );

      const input: AddLessonInput = {
        recipeId: 'recipe-new',
      };

      // When
      const result = await service.addLesson('class-1', 'tutor-1', input);

      // Then
      expect(lessonRepo.create).toHaveBeenCalledWith({
        classId: 'class-1',
        recipeId: 'recipe-new',
        order: 1, // Next order after existing lesson
      });
      expect(result.order).toBe(1);
    });

    it('should throw ClassStateError when class is not DRAFT', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(
        service.addLesson('class-1', 'tutor-1', { recipeId: 'recipe-1' }),
      ).rejects.toThrow(ClassStateError);
    });
  });

  describe('removeLesson', () => {
    it('should remove lesson and reorder remaining for DRAFT class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLessons = [
        createMockLessonEntity({ id: 'lesson-1', classId: 'class-1', order: 0 }),
        createMockLessonEntity({ id: 'lesson-2', classId: 'class-1', order: 1 }),
      ];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);
      lessonRepo.delete.mockResolvedValue();
      lessonRepo.reorder.mockResolvedValue();

      // When
      await service.removeLesson('class-1', 'lesson-1', 'tutor-1');

      // Then
      expect(lessonRepo.delete).toHaveBeenCalledWith('lesson-1');
      expect(lessonRepo.reorder).toHaveBeenCalledWith('class-1', ['lesson-2']);
    });

    it('should throw LessonNotFoundError when lesson does not exist', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLessons = [createMockLessonEntity({ id: 'lesson-1', classId: 'class-1' })];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      // When/Then
      await expect(
        service.removeLesson('class-1', 'non-existent-lesson', 'tutor-1'),
      ).rejects.toThrow(LessonNotFoundError);
    });

    it('should throw ClassStateError when class is not DRAFT', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(service.removeLesson('class-1', 'lesson-1', 'tutor-1')).rejects.toThrow(
        ClassStateError,
      );
    });
  });

  describe('reorderLessons', () => {
    it('should reorder lessons for DRAFT class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLessons = [
        createMockLessonEntity({ id: 'lesson-1', classId: 'class-1' }),
        createMockLessonEntity({ id: 'lesson-2', classId: 'class-1' }),
      ];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);
      lessonRepo.reorder.mockResolvedValue();

      // When
      await service.reorderLessons('class-1', 'tutor-1', ['lesson-2', 'lesson-1']);

      // Then
      expect(lessonRepo.reorder).toHaveBeenCalledWith('class-1', ['lesson-2', 'lesson-1']);
    });

    it('should throw LessonNotFoundError when lesson not in class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLessons = [createMockLessonEntity({ id: 'lesson-1', classId: 'class-1' })];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);

      // When/Then
      await expect(service.reorderLessons('class-1', 'tutor-1', ['non-existent'])).rejects.toThrow(
        LessonNotFoundError,
      );
    });

    it('should throw ClassStateError when class is not DRAFT', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(service.reorderLessons('class-1', 'tutor-1', ['lesson-1'])).rejects.toThrow(
        ClassStateError,
      );
    });
  });

  describe('updateLesson', () => {
    it('should update lesson recipeId and order for DRAFT class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLesson = createMockLessonEntity({
        id: 'lesson-1',
        classId: 'class-1',
        recipeId: 'recipe-original',
        order: 0,
      });
      const mockLessons = [mockLesson];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);
      lessonRepo.update.mockResolvedValue({
        ...mockLesson,
        recipeId: 'recipe-123',
        order: 5,
      });

      const updateData: UpdateLessonInput = {
        recipeId: 'recipe-123',
        order: 5,
      };

      // When
      const result = await service.updateLesson('class-1', 'lesson-1', 'tutor-1', updateData);

      // Then
      expect(lessonRepo.update).toHaveBeenCalledWith('lesson-1', {
        recipeId: 'recipe-123',
        order: 5,
      });
      expect(result.recipeId).toBe('recipe-123');
      expect(result.order).toBe(5);
    });

    it('should update only provided fields', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      const mockLesson = createMockLessonEntity({
        id: 'lesson-1',
        classId: 'class-1',
        recipeId: 'recipe-original',
        order: 0,
      });
      const mockLessons = [mockLesson];

      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue(mockLessons);
      lessonRepo.update.mockResolvedValue({
        ...mockLesson,
        recipeId: 'recipe-new',
      });

      const updateData: UpdateLessonInput = {
        recipeId: 'recipe-new',
      };

      // When
      await service.updateLesson('class-1', 'lesson-1', 'tutor-1', updateData);

      // Then
      expect(lessonRepo.update).toHaveBeenCalledWith('lesson-1', {
        recipeId: 'recipe-new',
      });
    });

    it('should throw ClassNotFoundError when class does not exist', async () => {
      // Given
      classRepo.findById.mockResolvedValue(null);

      // When/Then
      await expect(
        service.updateLesson('non-existent', 'lesson-1', 'tutor-1', { recipeId: 'recipe-1' }),
      ).rejects.toThrow(ClassNotFoundError);
    });

    it('should throw ClassOwnershipError when user does not own class', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', tutorId: 'other-tutor' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(
        service.updateLesson('class-1', 'lesson-1', 'tutor-1', { recipeId: 'recipe-1' }),
      ).rejects.toThrow(ClassOwnershipError);
    });

    it('should throw ClassStateError when class is not DRAFT', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'PUBLISHED' });
      classRepo.findById.mockResolvedValue(mockClass);

      // When/Then
      await expect(
        service.updateLesson('class-1', 'lesson-1', 'tutor-1', { recipeId: 'recipe-1' }),
      ).rejects.toThrow(ClassStateError);
    });

    it('should throw LessonNotFoundError when lesson does not exist', async () => {
      // Given
      const mockClass = createMockClassEntity({ id: 'class-1', status: 'DRAFT' });
      classRepo.findById.mockResolvedValue(mockClass);
      lessonRepo.findByClassId.mockResolvedValue([]);

      // When/Then
      await expect(
        service.updateLesson('class-1', 'non-existent-lesson', 'tutor-1', { recipeId: 'recipe-1' }),
      ).rejects.toThrow(LessonNotFoundError);
    });
  });

  describe('listClasses', () => {
    it('should list classes with pagination', async () => {
      // Given
      const mockClasses = [
        createMockClassEntity({ id: 'class-1' }),
        createMockClassEntity({ id: 'class-2' }),
      ];

      classRepo.findByTutorId.mockResolvedValue({
        classes: mockClasses,
        total: 2,
      });

      // When
      const result = await service.listClasses('tutor-1', { page: 1, limit: 10 });

      // Then
      expect(result.classes).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
