/**
 * Unit tests for PrismaClassLessonRepository.
 *
 * Covers:
 * - findByClassId with recipe inclusion and ordering
 * - findById (base repository)
 * - create with field mapping
 * - update with partial data
 * - delete (base repository)
 * - reorderLessons with two-phase approach
 * - NotFound handling
 */

import { PrismaClassLessonRepository } from '../prisma-class-lesson.repository';

// Mock the prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    classLesson: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaClassLessonRepository', () => {
  let repository: PrismaClassLessonRepository;

  const mockLesson1 = {
    id: 'lesson-1',
    classId: 'class-123',
    recipeId: 'recipe-1',
    order: 0,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    recipe: {
      id: 'recipe-1',
      title: 'Introduction to TypeScript',
      expectedDurationMinutes: 45,
    },
  };

  const mockLesson2 = {
    id: 'lesson-2',
    classId: 'class-123',
    recipeId: 'recipe-2',
    order: 1,
    createdAt: new Date('2024-01-01T11:00:00Z'),
    updatedAt: new Date('2024-01-01T11:00:00Z'),
    recipe: {
      id: 'recipe-2',
      title: 'Advanced TypeScript Patterns',
      expectedDurationMinutes: 60,
    },
  };

  const mockLesson3 = {
    id: 'lesson-3',
    classId: 'class-123',
    recipeId: 'recipe-3',
    order: 2,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
    recipe: null, // Some lessons might not have recipe (deleted or missing)
  };

  beforeEach(() => {
    repository = new PrismaClassLessonRepository();
    jest.clearAllMocks();
    // Mock $transaction to just resolve; actual update promises are created before passing
    (prisma.$transaction as jest.Mock).mockResolvedValue(undefined);
    // Default mock for update - can be overridden per test
    (prisma.classLesson.update as jest.Mock).mockResolvedValue({
      id: 'lesson-id',
      classId: 'class-id',
      recipeId: 'recipe-id',
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('findByClassId', () => {
    it('should return empty array when no lessons found for class', async () => {
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findByClassId('class-123');

      expect(result).toEqual([]);
      expect(prisma.classLesson.findMany).toHaveBeenCalledWith({
        where: { classId: 'class-123' },
        orderBy: { order: 'asc' },
        include: {
          recipe: { select: { id: true, title: true, expectedDurationMinutes: true } },
        },
      });
    });

    it('should return lessons ordered by order ascending', async () => {
      const lessons = [mockLesson1, mockLesson2, mockLesson3]; // already in order
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await repository.findByClassId('class-123');

      expect(result).toHaveLength(3);
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });

    it('should include recipe with selected fields', async () => {
      const lessons = [mockLesson1, mockLesson2];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await repository.findByClassId('class-123');

      expect(result[0].recipe).toEqual({
        id: 'recipe-1',
        title: 'Introduction to TypeScript',
        expectedDurationMinutes: 45,
      });
      expect(result[1].recipe).toEqual({
        id: 'recipe-2',
        title: 'Advanced TypeScript Patterns',
        expectedDurationMinutes: 60,
      });
    });

    it('should handle lessons without recipe (null recipe)', async () => {
      const lessons = [mockLesson3];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await repository.findByClassId('class-123');

      expect(result[0].recipe).toBeUndefined();
    });

    it('should call findMany with correct parameters', async () => {
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue([]);

      await repository.findByClassId('class-xyz');

      expect(prisma.classLesson.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.classLesson.findMany).toHaveBeenCalledWith({
        where: { classId: 'class-xyz' },
        orderBy: { order: 'asc' },
        include: {
          recipe: { select: { id: true, title: true, expectedDurationMinutes: true } },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return lesson with recipe when found', async () => {
      (prisma.classLesson.findUnique as jest.Mock).mockResolvedValue(mockLesson1);

      const result = await repository.findById('lesson-1');

      expect(result).toEqual({
        id: 'lesson-1',
        classId: 'class-123',
        recipeId: 'recipe-1',
        order: 0,
        createdAt: mockLesson1.createdAt,
        updatedAt: mockLesson1.updatedAt,
        recipe: {
          id: 'recipe-1',
          title: 'Introduction to TypeScript',
          expectedDurationMinutes: 45,
        },
      });
    });

    it('should return null when lesson not found', async () => {
      (prisma.classLesson.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should find lesson by id without recipe', async () => {
      const lessonWithoutRecipe = { ...mockLesson3, recipe: null };
      (prisma.classLesson.findUnique as jest.Mock).mockResolvedValue(lessonWithoutRecipe);

      const result = await repository.findById('lesson-3');

      expect(result?.recipe).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create lesson with correct mapped fields', async () => {
      const createData = {
        classId: 'class-new',
        recipeId: 'recipe-new',
        order: 0,
      };

      (prisma.classLesson.create as jest.Mock).mockResolvedValue({
        ...createData,
        id: 'new-lesson-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.create(createData);

      expect(prisma.classLesson.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual({
        id: 'new-lesson-id',
        classId: 'class-new',
        recipeId: 'recipe-new',
        order: 0,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should not include undefined fields in create data', async () => {
      // The create method should only pass the three required fields
      const createData = {
        classId: 'class-test',
        recipeId: 'recipe-test',
        order: 2,
      };

      (prisma.classLesson.create as jest.Mock).mockResolvedValue({
        ...createData,
        id: 'lesson-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.create(createData);

      expect(prisma.classLesson.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-test',
          recipeId: 'recipe-test',
          order: 2,
        },
      });
    });
  });

  describe('update', () => {
    it('should update lesson with partial data', async () => {
      const updateData = {
        order: 5,
        recipeId: 'recipe-updated',
      };

      (prisma.classLesson.update as jest.Mock).mockResolvedValue({
        id: 'lesson-1',
        classId: 'class-123',
        recipeId: 'recipe-updated',
        order: 5,
        createdAt: mockLesson1.createdAt,
        updatedAt: new Date(),
      });

      const result = await repository.update('lesson-1', updateData);

      expect(prisma.classLesson.update).toHaveBeenCalledWith({
        where: { id: 'lesson-1' },
        data: {
          order: 5,
          recipeId: 'recipe-updated',
        },
      });
      expect(result.order).toBe(5);
      expect(result.recipeId).toBe('recipe-updated');
    });

    it('should filter out undefined fields from update', async () => {
      // prepareUpdateData should filter undefined values
      const updateData = {
        order: 10,
        recipeId: undefined, // should be filtered out
      } as any;

      (prisma.classLesson.update as jest.Mock).mockResolvedValue({
        id: 'lesson-1',
        classId: 'class-123',
        recipeId: 'recipe-1',
        order: 10,
        createdAt: mockLesson1.createdAt,
        updatedAt: new Date(),
      });

      await repository.update('lesson-1', updateData);

      expect(prisma.classLesson.update).toHaveBeenCalledWith({
        where: { id: 'lesson-1' },
        data: { order: 10 }, // recipeId should NOT be included
      });
    });

    it('should update only order field', async () => {
      const updateData = { order: 3 };

      (prisma.classLesson.update as jest.Mock).mockResolvedValue({
        id: 'lesson-2',
        classId: 'class-123',
        recipeId: 'recipe-2',
        order: 3,
        createdAt: mockLesson2.createdAt,
        updatedAt: new Date(),
      });

      const result = await repository.update('lesson-2', updateData);

      expect(prisma.classLesson.update).toHaveBeenCalledWith({
        where: { id: 'lesson-2' },
        data: { order: 3 },
      });
      expect(result.order).toBe(3);
    });
  });

  describe('delete', () => {
    it('should delete lesson by id', async () => {
      (prisma.classLesson.delete as jest.Mock).mockResolvedValue(mockLesson1);

      await repository.delete('lesson-1');

      expect(prisma.classLesson.delete).toHaveBeenCalledWith({
        where: { id: 'lesson-1' },
      });
    });

    it('should handle deletion of non-existent lesson', async () => {
      (prisma.classLesson.delete as jest.Mock).mockRejectedValue(
        new Error('Record to delete not found.'),
      );

      await expect(repository.delete('non-existent')).rejects.toThrow(
        'Record to delete not found.',
      );
    });
  });

  describe('reorder', () => {
    const classId = 'class-123';
    const lessonIds = ['lesson-1', 'lesson-2', 'lesson-3'];

    it('should fetch lessons and call $transaction twice', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 0 },
        { id: 'lesson-2', order: 1 },
        { id: 'lesson-3', order: 2 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, lessonIds);

      expect(prisma.classLesson.findMany).toHaveBeenCalledWith({
        where: { id: { in: lessonIds }, classId },
        select: { id: true, order: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should apply temporary offset to avoid constraint violations', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 0 },
        { id: 'lesson-2', order: 1 },
        { id: 'lesson-3', order: 2 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, lessonIds);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      // First 3 calls: temp assignments
      expect(updateCalls[0][0]).toEqual({
        where: { id: 'lesson-1', classId },
        data: { order: 10000 },
      });
      expect(updateCalls[1][0]).toEqual({
        where: { id: 'lesson-2', classId },
        data: { order: 10001 },
      });
      expect(updateCalls[2][0]).toEqual({
        where: { id: 'lesson-3', classId },
        data: { order: 10002 },
      });
    });

    it('should apply final order values based on provided lessonIds', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 0 },
        { id: 'lesson-2', order: 1 },
        { id: 'lesson-3', order: 2 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, lessonIds);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      // Next 3 calls: final assignments (0,1,2)
      expect(updateCalls[3][0]).toEqual({
        where: { id: 'lesson-1', classId },
        data: { order: 0 },
      });
      expect(updateCalls[4][0]).toEqual({
        where: { id: 'lesson-2', classId },
        data: { order: 1 },
      });
      expect(updateCalls[5][0]).toEqual({
        where: { id: 'lesson-3', classId },
        data: { order: 2 },
      });
    });

    it('should handle reversed order correctly', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 0 },
        { id: 'lesson-2', order: 1 },
        { id: 'lesson-3', order: 2 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      // Reverse order: lesson-3, lesson-2, lesson-1
      await repository.reorder(classId, ['lesson-3', 'lesson-2', 'lesson-1']);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      // Temp phase maintains original orders
      expect(updateCalls[0][0].where.id).toBe('lesson-3');
      expect(updateCalls[0][0].data.order).toBe(10002);
      expect(updateCalls[1][0].where.id).toBe('lesson-2');
      expect(updateCalls[1][0].data.order).toBe(10001);
      expect(updateCalls[2][0].where.id).toBe('lesson-1');
      expect(updateCalls[2][0].data.order).toBe(10000);

      // Final phase assigns 0,1,2 in the new order
      expect(updateCalls[3][0]).toEqual({
        where: { id: 'lesson-3', classId },
        data: { order: 0 },
      });
      expect(updateCalls[4][0]).toEqual({
        where: { id: 'lesson-2', classId },
        data: { order: 1 },
      });
      expect(updateCalls[5][0]).toEqual({
        where: { id: 'lesson-1', classId },
        data: { order: 2 },
      });
    });

    it('should handle non-sequential current orders', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 5 },
        { id: 'lesson-2', order: 10 },
        { id: 'lesson-3', order: 15 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, lessonIds);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      // Temp orders: current + 10000
      expect(updateCalls[0][0].data.order).toBe(10005);
      expect(updateCalls[1][0].data.order).toBe(10010);
      expect(updateCalls[2][0].data.order).toBe(10015);
      // Final orders
      expect(updateCalls[3][0].data.order).toBe(0);
      expect(updateCalls[4][0].data.order).toBe(1);
      expect(updateCalls[5][0].data.order).toBe(2);
    });

    it('should use fallback index when lesson missing from current orders', async () => {
      // lesson-2 missing (deleted concurrently)
      const currentLessons = [
        { id: 'lesson-1', order: 0 },
        { id: 'lesson-3', order: 2 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, lessonIds);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      // Temp: lesson-2 uses index fallback
      expect(updateCalls[0][0]).toEqual({
        where: { id: 'lesson-1', classId },
        data: { order: 10000 },
      });
      expect(updateCalls[1][0]).toEqual({
        where: { id: 'lesson-2', classId },
        data: { order: 10001 }, // fallback to index 1
      });
      expect(updateCalls[2][0]).toEqual({
        where: { id: 'lesson-3', classId },
        data: { order: 10002 },
      });
      // Final: all get sequential
      expect(updateCalls[3][0].data.order).toBe(0);
      expect(updateCalls[4][0].data.order).toBe(1);
      expect(updateCalls[5][0].data.order).toBe(2);
    });

    it('should include classId in all update where clauses', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 0 },
        { id: 'lesson-2', order: 1 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder('specific-class', ['lesson-1', 'lesson-2']);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      updateCalls.forEach((call: any) => {
        expect(call[0].where).toHaveProperty('classId', 'specific-class');
      });
    });

    it('should handle empty lessonIds array', async () => {
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, []);

      expect(prisma.classLesson.findMany).toHaveBeenCalledWith({
        where: { id: { in: [] }, classId },
        select: { id: true, order: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      const calls = (prisma.$transaction as jest.Mock).mock.calls;
      expect(calls[0][0]).toEqual([]);
      expect(calls[1][0]).toEqual([]);
    });

    it('should handle large order values gracefully', async () => {
      const currentLessons = [
        { id: 'lesson-1', order: 100000 },
        { id: 'lesson-2', order: 200000 },
        { id: 'lesson-3', order: 300000 },
      ];
      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(currentLessons);
      (prisma.classLesson.update as jest.Mock).mockResolvedValue({});

      await repository.reorder(classId, lessonIds);

      const updateCalls = (prisma.classLesson.update as jest.Mock).mock.calls;
      // Temp orders: current + 10000
      expect(updateCalls[0][0].data.order).toBe(110000);
      expect(updateCalls[1][0].data.order).toBe(210000);
      expect(updateCalls[2][0].data.order).toBe(310000);
      // Final orders
      expect(updateCalls[3][0].data.order).toBe(0);
      expect(updateCalls[4][0].data.order).toBe(1);
      expect(updateCalls[5][0].data.order).toBe(2);
    });
  });

  // Additional tests to reach 15+

  describe('ordering consistency', () => {
    it('findByClassId should preserve recipe data for all lessons', async () => {
      const lessons = [
        {
          ...mockLesson1,
          recipe: {
            id: 'recipe-1',
            title: 'Lesson 1',
            expectedDurationMinutes: 30,
          },
        },
        {
          ...mockLesson2,
          recipe: {
            id: 'recipe-2',
            title: 'Lesson 2',
            expectedDurationMinutes: 45,
          },
        },
        {
          ...mockLesson3,
          recipe: {
            id: 'recipe-3',
            title: 'Lesson 3',
            expectedDurationMinutes: 60,
          },
        },
      ];

      (prisma.classLesson.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await repository.findByClassId('class-123');

      lessons.forEach((expected, i) => {
        expect(result[i].recipe).toEqual(expected.recipe);
      });
    });
  });

  describe('findById edge cases', () => {
    it('should return lesson without recipe when recipe is null', async () => {
      const lessonWithNullRecipe = {
        ...mockLesson1,
        recipe: null,
      };
      (prisma.classLesson.findUnique as jest.Mock).mockResolvedValue(lessonWithNullRecipe);

      const result = await repository.findById('lesson-1');

      expect(result?.recipe).toBeUndefined();
    });

    it('should return partial recipe if only some fields exist', async () => {
      const partialRecipeLesson = {
        ...mockLesson1,
        recipe: {
          id: 'recipe-1',
          title: 'Partial Recipe',
          // expectedDurationMinutes missing
        },
      };
      (prisma.classLesson.findUnique as jest.Mock).mockResolvedValue(partialRecipeLesson);

      const result = await repository.findById('lesson-1');

      expect(result?.recipe).toEqual({
        id: 'recipe-1',
        title: 'Partial Recipe',
        expectedDurationMinutes: undefined,
      });
    });
  });

  describe('create mapping', () => {
    it('should ignore extra fields in create input', async () => {
      const createData = {
        classId: 'class-123',
        recipeId: 'recipe-abc',
        order: 1,
        // These should be ignored:
        id: 'should-be-ignored',
        createdAt: new Date(),
        updatedAt: new Date(),
        extraField: 'ignore me',
      };

      (prisma.classLesson.create as jest.Mock).mockResolvedValue({
        id: 'generated-id',
        classId: 'class-123',
        recipeId: 'recipe-abc',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.create(createData);

      expect(prisma.classLesson.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-123',
          recipeId: 'recipe-abc',
          order: 1,
        },
      });
    });
  });

  describe('update partial data', () => {
    it('should update classId when provided', async () => {
      const updateData = {
        order: 5,
        classId: 'different-class',
      } as any;

      (prisma.classLesson.update as jest.Mock).mockResolvedValue({
        id: 'lesson-1',
        classId: 'different-class',
        recipeId: 'recipe-1',
        order: 5,
        createdAt: mockLesson1.createdAt,
        updatedAt: new Date(),
      });

      const result = await repository.update('lesson-1', updateData);

      expect(prisma.classLesson.update).toHaveBeenCalledWith({
        where: { id: 'lesson-1' },
        data: {
          classId: 'different-class',
          order: 5,
        },
      });
      expect(result.classId).toBe('different-class');
    });

    it('should update only recipeId when that is the only field', async () => {
      const updateData = {
        recipeId: 'new-recipe',
      };

      (prisma.classLesson.update as jest.Mock).mockResolvedValue({
        ...mockLesson1,
        recipeId: 'new-recipe',
      });

      await repository.update('lesson-1', updateData);

      expect(prisma.classLesson.update).toHaveBeenCalledWith({
        where: { id: 'lesson-1' },
        data: { recipeId: 'new-recipe' },
      });
    });
  });
});
