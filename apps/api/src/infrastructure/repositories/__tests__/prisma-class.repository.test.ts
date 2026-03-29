/**
 * Unit tests for PrismaClassRepository.
 *
 * Tests the 5 repository methods: findById, findByTutorId, create, update, delete
 * Includes comprehensive coverage of success cases, error cases, edge cases, and integration.
 */

import { PrismaClassRepository } from '../prisma-class.repository';

// Mock the prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    class: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaClassRepository', () => {
  let repository: PrismaClassRepository;

  const mockClassEntity = {
    id: 'class-123',
    title: 'Test Class',
    description: 'A test class',
    tutorId: 'tutor-456',
    classTemplateId: undefined, // null -> undefined via mapper
    currentVersionId: undefined, // null -> undefined via mapper
    status: 'DRAFT' as const,
    version: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lessons: [
      {
        id: 'lesson-1',
        classId: 'class-123',
        recipeId: 'recipe-1',
        order: 0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        recipe: {
          id: 'recipe-1',
          title: 'Recipe 1',
          expectedDurationMinutes: 30,
        },
      },
      {
        id: 'lesson-2',
        classId: 'class-123',
        recipeId: 'recipe-2',
        order: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        recipe: {
          id: 'recipe-2',
          title: 'Recipe 2',
          expectedDurationMinutes: 45,
        },
      },
    ],
  };

  const mockPrismaClass = {
    id: 'class-123',
    title: 'Test Class',
    description: 'A test class',
    tutorId: 'tutor-456',
    classTemplateId: null,
    currentVersionId: null,
    status: 'DRAFT',
    version: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lessons: [
      {
        id: 'lesson-1',
        classId: 'class-123',
        recipeId: 'recipe-1',
        order: 0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        recipe: {
          id: 'recipe-1',
          title: 'Recipe 1',
          expectedDurationMinutes: 30,
        },
      },
      {
        id: 'lesson-2',
        classId: 'class-123',
        recipeId: 'recipe-2',
        order: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        recipe: {
          id: 'recipe-2',
          title: 'Recipe 2',
          expectedDurationMinutes: 45,
        },
      },
    ],
  };

  beforeEach(() => {
    repository = new PrismaClassRepository();
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return class entity with lessons when found', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(mockPrismaClass);

      const result = await repository.findById('class-123');

      expect(result).toEqual(mockClassEntity);
      expect(prisma.class.findUnique).toHaveBeenCalledWith({
        where: { id: 'class-123' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should return null when class not found', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
      expect(prisma.class.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should handle class without lessons (undefined returns undefined)', async () => {
      const classWithoutLessons = {
        ...mockPrismaClass,
        lessons: undefined,
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithoutLessons);

      const result = await repository.findById('class-123');

      // When Prisma lessons is undefined, the mapper returns undefined (not empty array)
      // because it uses optional chaining: prismaClass.lessons?.map(...)
      expect(result?.lessons).toBeUndefined();
    });

    it('should map description null to undefined', async () => {
      const classWithNullDesc = {
        ...mockPrismaClass,
        description: null,
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithNullDesc);

      const result = await repository.findById('class-123');

      expect(result?.description).toBeUndefined();
    });

    it('should map classTemplateId null to undefined', async () => {
      const classWithNullTemplate = {
        ...mockPrismaClass,
        classTemplateId: null,
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithNullTemplate);

      const result = await repository.findById('class-123');

      expect(result?.classTemplateId).toBeUndefined();
    });

    it('should handle currentVersionId null', async () => {
      const classWithNullVersion = {
        ...mockPrismaClass,
        currentVersionId: null,
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithNullVersion);

      const result = await repository.findById('class-123');

      expect(result?.currentVersionId).toBeUndefined();
    });

    it('should propagate database errors', async () => {
      const error = new Error('Database connection failed');
      (prisma.class.findUnique as jest.Mock).mockRejectedValue(error);

      await expect(repository.findById('class-123')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByTutorId', () => {
    it('should return paginated results with default page and limit', async () => {
      const classes = [mockPrismaClass];
      (prisma.class.findMany as jest.Mock).mockResolvedValue(classes);
      (prisma.class.count as jest.Mock).mockResolvedValue(1);

      const result = await repository.findByTutorId('tutor-456');

      expect(result).toEqual({
        classes: [mockClassEntity],
        total: 1,
      });
      expect(prisma.class.findMany).toHaveBeenCalledWith({
        where: { tutorId: 'tutor-456' },
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
        skip: 0,
        take: 20,
      });
      expect(prisma.class.count).toHaveBeenCalledWith({
        where: { tutorId: 'tutor-456' },
      });
    });

    it('should calculate skip as (page - 1) * limit for page 1', async () => {
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.class.count as jest.Mock).mockResolvedValue(0);

      await repository.findByTutorId('tutor-456', { page: 1, limit: 10 });

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should calculate skip as (page - 1) * limit for page 3', async () => {
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.class.count as jest.Mock).mockResolvedValue(0);

      await repository.findByTutorId('tutor-456', { page: 3, limit: 20 });

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3-1) * 20
          take: 20,
        }),
      );
    });

    it('should apply status filter when provided', async () => {
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.class.count as jest.Mock).mockResolvedValue(0);

      await repository.findByTutorId('tutor-456', { status: 'PUBLISHED' });

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tutorId: 'tutor-456',
            status: 'PUBLISHED',
          },
        }),
      );
      expect(prisma.class.count).toHaveBeenCalledWith({
        where: {
          tutorId: 'tutor-456',
          status: 'PUBLISHED',
        },
      });
    });

    it('should not apply status filter when undefined', async () => {
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.class.count as jest.Mock).mockResolvedValue(0);

      await repository.findByTutorId('tutor-456', { status: undefined });

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tutorId: 'tutor-456',
          },
        }),
      );
    });

    it('should return empty arrays when no classes found', async () => {
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.class.count as jest.Mock).mockResolvedValue(0);

      const result = await repository.findByTutorId('tutor-456');

      expect(result.classes).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return multiple classes ordered by updatedAt DESC', async () => {
      const newerClass = {
        ...mockPrismaClass,
        id: 'class-2',
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };
      const olderClass = {
        ...mockPrismaClass,
        id: 'class-1',
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      (prisma.class.findMany as jest.Mock).mockResolvedValue([newerClass, olderClass]);
      (prisma.class.count as jest.Mock).mockResolvedValue(2);

      const result = await repository.findByTutorId('tutor-456');

      expect(result.classes).toHaveLength(2);
      expect(result.classes[0].id).toBe('class-2');
      expect(result.classes[1].id).toBe('class-1');
    });

    it('should include recipes with selected fields', async () => {
      (prisma.class.findMany as jest.Mock).mockResolvedValue([mockPrismaClass]);
      (prisma.class.count as jest.Mock).mockResolvedValue(1);

      await repository.findByTutorId('tutor-456');

      expect(prisma.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                recipe: {
                  select: {
                    id: true,
                    title: true,
                    expectedDurationMinutes: true,
                  },
                },
              },
            },
          },
        }),
      );
    });

    it('should return accurate total count separate from returned classes', async () => {
      const allClasses = Array.from({ length: 50 }, (_, i) => ({
        ...mockPrismaClass,
        id: `class-${i}`,
      }));
      (prisma.class.findMany as jest.Mock).mockResolvedValue(allClasses.slice(0, 20));
      (prisma.class.count as jest.Mock).mockResolvedValue(50);

      const result = await repository.findByTutorId('tutor-456', { page: 1, limit: 20 });

      expect(result.total).toBe(50);
      expect(result.classes).toHaveLength(20);
    });

    it('should propagate count query errors', async () => {
      const error = new Error('Count query failed');
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.class.count as jest.Mock).mockRejectedValue(error);

      await expect(repository.findByTutorId('tutor-456')).rejects.toThrow('Count query failed');
    });

    it('should propagate findMany query errors', async () => {
      const error = new Error('Find many failed');
      (prisma.class.findMany as jest.Mock).mockRejectedValue(error);

      await expect(repository.findByTutorId('tutor-456')).rejects.toThrow('Find many failed');
    });
  });

  describe('create', () => {
    it('should create class with all required and optional fields', async () => {
      const createData = {
        title: 'New Class',
        description: 'Class description',
        tutorId: 'tutor-456',
        classTemplateId: 'template-123',
        currentVersionId: 'version-1',
        status: 'DRAFT',
        version: 0,
      };
      (prisma.class.create as jest.Mock).mockResolvedValue({
        ...mockPrismaClass,
        ...createData,
        id: 'new-class-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        lessons: [],
      });

      const result = await repository.create(createData);

      expect(prisma.class.create).toHaveBeenCalledWith({
        data: createData,
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result.id).toBeDefined();
    });

    it('should create class with only required fields', async () => {
      const minimalData = {
        title: 'Minimal Class',
        tutorId: 'tutor-456',
        status: 'DRAFT',
        version: 0,
      };
      (prisma.class.create as jest.Mock).mockResolvedValue({
        ...mockPrismaClass,
        ...minimalData,
        id: 'new-class-id',
        description: null,
        classTemplateId: null,
        currentVersionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lessons: [],
      });

      const result = await repository.create(minimalData);

      expect(prisma.class.create).toHaveBeenCalledWith({
        data: minimalData,
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result.description).toBeUndefined();
      expect(result.classTemplateId).toBeUndefined();
      expect(result.currentVersionId).toBeUndefined();
    });

    it('should return entity with lessons when created with includes', async () => {
      const createData = {
        title: 'Class with Lessons',
        tutorId: 'tutor-456',
        status: 'DRAFT',
        version: 0,
      };
      (prisma.class.create as jest.Mock).mockResolvedValue(mockPrismaClass);

      const result = await repository.create(createData);

      expect(result).toEqual(mockClassEntity); // mockClassEntity now has undefined for null fields
      expect(result.lessons).toHaveLength(2);
    });

    it('should propagate prisma create errors', async () => {
      const error = new Error('Unique constraint failed');
      (prisma.class.create as jest.Mock).mockRejectedValue(error);

      await expect(
        repository.create({
          title: 'Test',
          tutorId: 'tutor-1',
          status: 'DRAFT',
          version: 0,
        }),
      ).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('update', () => {
    it('should update title only', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        title: 'Updated Title',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(prisma.class.update).toHaveBeenCalledWith({
        where: { id: 'class-123' },
        data: { title: 'Updated Title' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should update description only', async () => {
      const updateData = { description: 'Updated description' };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        description: 'Updated description',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(prisma.class.update).toHaveBeenCalledWith({
        where: { id: 'class-123' },
        data: { description: 'Updated description' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result.description).toBe('Updated description');
    });

    it('should update tutorId', async () => {
      const updateData = { tutorId: 'new-tutor-789' };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        tutorId: 'new-tutor-789',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(result.tutorId).toBe('new-tutor-789');
    });

    it('should update classTemplateId', async () => {
      const updateData = { classTemplateId: 'template-999' };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        classTemplateId: 'template-999',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(result.classTemplateId).toBe('template-999');
    });

    it('should update currentVersionId', async () => {
      const updateData = { currentVersionId: 'version-2' };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        currentVersionId: 'version-2',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(result.currentVersionId).toBe('version-2');
    });

    it('should update status', async () => {
      const updateData = { status: 'PUBLISHED' as const };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        status: 'PUBLISHED',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(result.status).toBe('PUBLISHED');
    });

    it('should update version', async () => {
      const updateData = { version: 2 };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        version: 2,
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(result.version).toBe(2);
    });

    it('should update multiple fields simultaneously', async () => {
      const updateData = {
        title: 'New Title',
        description: 'New Description',
        status: 'UNDER_REVIEW' as const,
        version: 1,
      };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        ...updateData,
      };
      const expectedEntity = {
        ...mockClassEntity,
        ...updateData,
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      const result = await repository.update('class-123', updateData);

      expect(prisma.class.update).toHaveBeenCalledWith({
        where: { id: 'class-123' },
        data: updateData,
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result).toEqual(expectedEntity);
    });

    it('should ignore undefined fields', async () => {
      const updateData = {
        title: 'Updated Title',
        description: undefined,
      };
      const updatedPrismaClass = {
        ...mockPrismaClass,
        title: 'Updated Title',
        description: 'A test class',
      };
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);

      await repository.update('class-123', updateData);

      expect(prisma.class.update).toHaveBeenCalledWith({
        where: { id: 'class-123' },
        data: { title: 'Updated Title' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should throw when class not found', async () => {
      (prisma.class.update as jest.Mock).mockResolvedValue(null);

      await expect(repository.update('non-existent', { title: 'Test' })).rejects.toThrow();
    });

    it('should propagate prisma update errors', async () => {
      const error = new Error('Update failed');
      (prisma.class.update as jest.Mock).mockRejectedValue(error);

      await expect(repository.update('class-123', { title: 'New Title' })).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete class successfully', async () => {
      (prisma.class.delete as jest.Mock).mockResolvedValue(mockPrismaClass);

      await expect(repository.delete('class-123')).resolves.not.toThrow();

      expect(prisma.class.delete).toHaveBeenCalledWith({
        where: { id: 'class-123' },
      });
    });

    it('should throw when class not found', async () => {
      const error = new Error('P2025: Record to delete not found');
      (prisma.class.delete as jest.Mock).mockRejectedValue(error);

      await expect(repository.delete('non-existent')).rejects.toThrow('P2025');
    });

    it('should propagate prisma delete errors', async () => {
      const error = new Error('Delete failed due to foreign key constraint');
      (prisma.class.delete as jest.Mock).mockRejectedValue(error);

      await expect(repository.delete('class-123')).rejects.toThrow(
        'Delete failed due to foreign key constraint',
      );
    });
  });

  describe('Integration Tests', () => {
    it('should create and then findById returns same entity', async () => {
      const createData = {
        title: 'Integration Test Class',
        tutorId: 'tutor-456',
        status: 'DRAFT',
        version: 0,
      };
      const createdClass = {
        ...mockPrismaClass,
        ...createData,
        id: 'created-class-id',
      };
      (prisma.class.create as jest.Mock).mockResolvedValue(createdClass);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(createdClass);

      await repository.create(createData);
      const result = await repository.findById('created-class-id');

      expect(result?.id).toBe('created-class-id');
      expect(result?.title).toBe('Integration Test Class');
    });

    it('should update and then findById reflects changes', async () => {
      const originalClass = mockPrismaClass;
      const updatedPrismaClass = {
        ...originalClass,
        title: 'Updated Title',
        status: 'PUBLISHED',
      };
      const expectedEntity = {
        ...mockClassEntity,
        title: 'Updated Title',
        status: 'PUBLISHED',
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(originalClass);
      (prisma.class.update as jest.Mock).mockResolvedValue(updatedPrismaClass);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(updatedPrismaClass);

      await repository.update('class-123', { title: 'Updated Title', status: 'PUBLISHED' });
      const result = await repository.findById('class-123');

      expect(result).toEqual(expectedEntity);
    });

    it('should delete and then findById returns null', async () => {
      (prisma.class.delete as jest.Mock).mockResolvedValue(mockPrismaClass);
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(null);

      await repository.delete('class-123');
      const result = await repository.findById('class-123');

      expect(result).toBeNull();
    });

    it('should handle pagination correctly across multiple calls', async () => {
      const classes = Array.from({ length: 35 }, (_, i) => ({
        ...mockPrismaClass,
        id: `class-${i}`,
        updatedAt: new Date(Date.now() - i * 60000), // Each one minute older
      }));

      (prisma.class.findMany as jest.Mock)
        .mockResolvedValueOnce(classes.slice(0, 20)) // page 1
        .mockResolvedValueOnce(classes.slice(20, 40)); // page 2
      (prisma.class.count as jest.Mock).mockResolvedValue(35);

      const page1 = await repository.findByTutorId('tutor-456', { page: 1, limit: 20 });
      const page2 = await repository.findByTutorId('tutor-456', { page: 2, limit: 20 });

      expect(page1.classes).toHaveLength(20);
      expect(page2.classes).toHaveLength(15);
      expect(page1.total).toBe(35);
      expect(page2.total).toBe(35);
    });
  });

  describe('Edge Cases', () => {
    it('should handle lessons with missing recipe snapshot gracefully', async () => {
      const classWithIncompleteLesson = {
        ...mockPrismaClass,
        lessons: [
          {
            id: 'lesson-1',
            classId: 'class-123',
            recipeId: 'recipe-1',
            order: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            // recipe is undefined - should be filtered out by mapping
          },
        ],
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithIncompleteLesson);

      const result = await repository.findById('class-123');

      expect(result?.lessons?.[0].recipe).toBeUndefined();
    });

    it('should handle class with zero lessons', async () => {
      const classWithZeroLessons = {
        ...mockPrismaClass,
        lessons: [],
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithZeroLessons);

      const result = await repository.findById('class-123');

      expect(result?.lessons).toEqual([]);
    });

    it('should handle special characters in text fields', async () => {
      const specialClass = {
        ...mockPrismaClass,
        title: 'Clase de Matemáticas: Álgebra & Geometría <100%>',
        description: 'Año 2024 - "Primer Semestre"',
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(specialClass);

      const result = await repository.findById('class-123');

      expect(result?.title).toBe('Clase de Matemáticas: Álgebra & Geometría <100%>');
      expect(result?.description).toBe('Año 2024 - "Primer Semestre"');
    });

    it('should handle empty string for optional description', async () => {
      const classWithEmptyDesc = {
        ...mockPrismaClass,
        description: '',
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithEmptyDesc);

      const result = await repository.findById('class-123');

      expect(result?.description).toBe('');
    });
  });

  describe('Mapping Tests', () => {
    it('should correctly map Prisma Class fields to ClassEntity', async () => {
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(mockPrismaClass);

      const result = await repository.findById('class-123');

      expect(result).toMatchObject({
        id: 'class-123',
        title: 'Test Class',
        description: 'A test class',
        tutorId: 'tutor-456',
        status: 'DRAFT',
        version: 1,
      });
      expect(typeof result!.createdAt).toBe('object');
      expect(typeof result!.updatedAt).toBe('object');
    });

    it('should exclude version snapshots from entity mapping', async () => {
      const classWithVersions = {
        ...mockPrismaClass,
        versions: [
          {
            id: 'version-1',
            classId: 'class-123',
            version: '1.0.0',
            publishedAt: new Date(),
            isPublished: true,
            title: 'Version 1',
            description: null,
            slug: 'test-class-v1',
            status: 'PUBLISHED',
            createdAt: new Date(),
          },
        ],
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithVersions);

      const result = await repository.findById('class-123');

      // versions should not be included in ClassEntity (not in the include)
      expect(result).not.toHaveProperty('versions');
    });

    it('should correctly map classTemplateId when set', async () => {
      const classWithTemplate = {
        ...mockPrismaClass,
        classTemplateId: 'template-123',
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithTemplate);

      const result = await repository.findById('class-123');

      expect(result?.classTemplateId).toBe('template-123');
    });

    it('should correctly map currentVersionId when set', async () => {
      const classWithVersion = {
        ...mockPrismaClass,
        currentVersionId: 'version-2',
      };
      (prisma.class.findUnique as jest.Mock).mockResolvedValue(classWithVersion);

      const result = await repository.findById('class-123');

      expect(result?.currentVersionId).toBe('version-2');
    });
  });
});
