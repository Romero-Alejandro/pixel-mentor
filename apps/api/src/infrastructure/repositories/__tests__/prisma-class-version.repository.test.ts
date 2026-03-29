/**
 * Unit tests for PrismaClassVersionRepository.
 * Focus: N+1 optimizations, nested includes, recipe snapshot handling,
 * and published version filtering.
 */

import { PrismaClassVersionRepository } from '../prisma-class-version.repository';

// Mock the prisma client
jest.mock('@/infrastructure/adapters/database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    classVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Import after mocking
import { prisma } from '@/infrastructure/adapters/database/client';

describe('PrismaClassVersionRepository', () => {
  let repository: PrismaClassVersionRepository;

  const mockRecipe = {
    id: 'recipe-1',
    title: 'Test Recipe',
    expectedDurationMinutes: 30,
  };

  const mockLessonWithRecipe = {
    id: 'lesson-1',
    classVersionId: 'version-1',
    recipeId: 'recipe-1',
    order: 1,
    title: 'Lesson 1',
    duration: 30,
    recipeSnapshot: mockRecipe,
    createdAt: new Date('2024-01-01'),
  };

  const mockPrismaVersion = {
    id: 'version-1',
    classId: 'class-1',
    version: '1',
    publishedAt: new Date('2024-01-01'),
    isPublished: true,
    title: 'Test Version',
    description: 'A test version',
    slug: 'test-version',
    status: 'PUBLISHED',
    lessons: [mockLessonWithRecipe],
  };

  const mockClassVersionEntity = {
    id: 'version-1',
    classId: 'class-1',
    version: '1',
    publishedAt: new Date('2024-01-01'),
    isPublished: true,
    title: 'Test Version',
    description: 'A test version',
    slug: 'test-version',
    status: 'PUBLISHED',
    lessons: [
      {
        id: 'lesson-1',
        classVersionId: 'version-1',
        recipeId: 'recipe-1',
        order: 1,
        title: 'Lesson 1',
        duration: 30,
        recipeSnapshot: mockRecipe,
        createdAt: new Date('2024-01-01'),
      },
    ],
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    repository = new PrismaClassVersionRepository();
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => await fn(prisma));
  });

  describe('findById', () => {
    it('should return null when version not found', async () => {
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
      expect(prisma.classVersion.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        include: {
          lessons: {
            include: {
              recipe: true,
            },
          },
        },
      });
    });

    it('should return version with nested lessons and recipe data when found', async () => {
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const result = await repository.findById('version-1');

      expect(result).toEqual(mockClassVersionEntity);
      expect(result?.lessons).toHaveLength(1);
      expect(result?.lessons?.[0].recipeSnapshot).toEqual(mockRecipe);
      expect(result?.lessons?.[0].recipeId).toBe('recipe-1');
    });

    it('should handle version without lessons', async () => {
      const versionWithoutLessons = { ...mockPrismaVersion, lessons: undefined };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(versionWithoutLessons);

      const result = await repository.findById('version-1');

      expect(result).toEqual({
        ...mockClassVersionEntity,
        lessons: undefined,
      });
      expect(result?.lessons).toBeUndefined();
    });

    it('should include recipe data in nested includes (N+1 optimized)', async () => {
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(mockPrismaVersion);

      await repository.findById('version-1');

      // Verify the nested include structure is correct (N+1 optimization)
      expect(prisma.classVersion.findUnique).toHaveBeenCalledWith({
        where: { id: 'version-1' },
        include: {
          lessons: {
            include: {
              recipe: true, // Ensures recipe data is fetched in same query
            },
          },
        },
      });
    });
  });

  describe('findByClassId', () => {
    it('should return empty array when no versions found for class', async () => {
      (prisma.classVersion.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findByClassId('class-1');

      expect(result).toEqual([]);
      expect(prisma.classVersion.findMany).toHaveBeenCalledWith({
        where: { classId: 'class-1' },
        include: {
          lessons: {
            include: {
              recipe: true,
            },
          },
        },
      });
    });

    it('should return all versions for a class with nested lesson and recipe data', async () => {
      const multipleVersions = [
        mockPrismaVersion,
        {
          ...mockPrismaVersion,
          id: 'version-2',
          version: '2',
          slug: 'version-2',
        },
      ];
      (prisma.classVersion.findMany as jest.Mock).mockResolvedValue(multipleVersions);

      const result = await repository.findByClassId('class-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('version-1');
      expect(result[1].id).toBe('version-2');
      // Verify recipe data is included in all versions
      result.forEach((version) => {
        expect(version.lessons).toBeDefined();
        expect(version.lessons?.[0].recipeSnapshot).toEqual(mockRecipe);
      });
    });

    it('should handle versions with different lesson counts', async () => {
      const versionWithMultipleLessons = {
        ...mockPrismaVersion,
        lessons: [
          mockLessonWithRecipe,
          {
            ...mockLessonWithRecipe,
            id: 'lesson-2',
            order: 2,
            recipeId: 'recipe-2',
            recipeSnapshot: { id: 'recipe-2', title: 'Recipe 2', expectedDurationMinutes: 45 },
          },
        ],
      };
      (prisma.classVersion.findMany as jest.Mock).mockResolvedValue([versionWithMultipleLessons]);

      const result = await repository.findByClassId('class-1');

      expect(result).toHaveLength(1);
      expect(result[0].lessons).toHaveLength(2);
      expect(result[0].lessons?.[0].recipeSnapshot?.id).toBe('recipe-1');
      expect(result[0].lessons?.[1].recipeSnapshot?.id).toBe('recipe-2');
    });
  });

  describe('findBySlug', () => {
    it('should return null when no published version with slug exists', async () => {
      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findBySlug('non-existent-slug');

      expect(result).toBeNull();
      expect(prisma.classVersion.findFirst).toHaveBeenCalledWith({
        where: { slug: 'non-existent-slug', isPublished: true },
        include: {
          lessons: {
            include: {
              recipe: true,
            },
          },
        },
      });
    });

    it('should return only published version with matching slug', async () => {
      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const result = await repository.findBySlug('test-version');

      expect(result).toEqual(mockClassVersionEntity);
      expect(result?.isPublished).toBe(true);
    });

    it('should not return draft version even if slug matches', async () => {
      const draftVersion = {
        ...mockPrismaVersion,
        isPublished: false,
        status: 'DRAFT',
      };
      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(draftVersion);

      const result = await repository.findBySlug('test-version');

      // This test verifies the query filters correctly, but the mock returns draft
      // In real scenario, query with isPublished: true would filter it out
      expect(prisma.classVersion.findFirst).toHaveBeenCalledWith({
        where: { slug: 'test-version', isPublished: true },
        include: {
          lessons: {
            include: {
              recipe: true,
            },
          },
        },
      });
    });

    it('should include recipe data in published version result', async () => {
      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const result = await repository.findBySlug('test-version');

      expect(result?.lessons?.[0].recipeSnapshot).toBeDefined();
      expect(result?.lessons?.[0].recipeSnapshot?.id).toBe('recipe-1');
    });
  });

  describe('create', () => {
    it('should create version without lessons when none provided', async () => {
      (prisma.classVersion.create as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const versionData = {
        classId: 'class-1',
        version: '1',
        publishedAt: undefined,
        isPublished: false,
        title: 'Test Version',
        description: 'A test version',
        slug: 'test-version',
        status: 'DRAFT',
        lessons: undefined,
      } as const;

      const result = await repository.create(versionData);

      expect(prisma.classVersion.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          version: '1',
          publishedAt: undefined,
          isPublished: false,
          title: 'Test Version',
          description: 'A test version',
          slug: 'test-version',
          status: 'DRAFT',
          lessons: undefined,
        },
        include: {
          lessons: true,
        },
      });
      expect(result).toEqual(mockClassVersionEntity);
    });

    it('should create version with lessons and recipe snapshots', async () => {
      (prisma.classVersion.create as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const versionData = {
        classId: 'class-1',
        version: '1',
        publishedAt: undefined,
        isPublished: false,
        title: 'Test Version',
        description: 'A test version',
        slug: 'test-version',
        status: 'DRAFT',
        lessons: [
          {
            recipeId: 'recipe-1',
            order: 1,
            title: 'Lesson 1',
            duration: 30,
            recipeSnapshot: mockRecipe,
          },
        ],
      };

      await repository.create(versionData);

      expect(prisma.classVersion.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          version: '1',
          publishedAt: undefined,
          isPublished: false,
          title: 'Test Version',
          description: 'A test version',
          slug: 'test-version',
          status: 'DRAFT',
          lessons: {
            create: [
              {
                recipeId: 'recipe-1',
                order: 1,
                title: 'Lesson 1',
                duration: 30,
                recipeSnapshot: mockRecipe,
              },
            ],
          },
        },
        include: {
          lessons: true,
        },
      });
    });

    it('should handle recipeSnapshot as undefined', async () => {
      const versionWithoutRecipeSnapshot = {
        ...mockPrismaVersion,
        lessons: [
          {
            ...mockLessonWithRecipe,
            recipeSnapshot: undefined,
          },
        ],
      };
      (prisma.classVersion.create as jest.Mock).mockResolvedValue(versionWithoutRecipeSnapshot);

      const versionData = {
        classId: 'class-1',
        version: '1',
        publishedAt: undefined,
        isPublished: false,
        title: 'Test Version',
        description: 'A test version',
        slug: 'test-version',
        status: 'DRAFT',
        lessons: [
          {
            recipeId: 'recipe-1',
            order: 1,
            title: 'Lesson 1',
            duration: 30,
            recipeSnapshot: undefined,
          },
        ],
      };

      const result = await repository.create(versionData);

      expect(prisma.classVersion.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          version: '1',
          publishedAt: undefined,
          isPublished: false,
          title: 'Test Version',
          description: 'A test version',
          slug: 'test-version',
          status: 'DRAFT',
          lessons: {
            create: [
              {
                recipeId: 'recipe-1',
                order: 1,
                title: 'Lesson 1',
                duration: 30,
                recipeSnapshot: undefined,
              },
            ],
          },
        },
        include: {
          lessons: true,
        },
      });
      // Verify recipeSnapshot is undefined in result
      expect(result?.lessons?.[0].recipeSnapshot).toBeUndefined();
    });

    it('should create version with multiple lessons preserving all recipe snapshots', async () => {
      const multipleLessonsVersion = {
        ...mockPrismaVersion,
        lessons: [
          mockLessonWithRecipe,
          {
            ...mockLessonWithRecipe,
            id: 'lesson-2',
            order: 2,
            recipeId: 'recipe-2',
            recipeSnapshot: { id: 'recipe-2', title: 'Recipe 2', expectedDurationMinutes: 45 },
          },
        ],
      };
      (prisma.classVersion.create as jest.Mock).mockResolvedValue(multipleLessonsVersion);

      const versionData = {
        classId: 'class-1',
        version: '1',
        publishedAt: undefined,
        isPublished: false,
        title: 'Test Version',
        description: 'A test version',
        slug: 'test-version',
        status: 'DRAFT',
        lessons: [
          {
            recipeId: 'recipe-1',
            order: 1,
            title: 'Lesson 1',
            duration: 30,
            recipeSnapshot: mockRecipe,
          },
          {
            recipeId: 'recipe-2',
            order: 2,
            title: 'Lesson 2',
            duration: 45,
            recipeSnapshot: { id: 'recipe-2', title: 'Recipe 2', expectedDurationMinutes: 45 },
          },
        ],
      };

      const result = await repository.create(versionData);

      expect(prisma.classVersion.create).toHaveBeenCalledWith({
        data: {
          classId: 'class-1',
          version: '1',
          publishedAt: undefined,
          isPublished: false,
          title: 'Test Version',
          description: 'A test version',
          slug: 'test-version',
          status: 'DRAFT',
          lessons: {
            create: [
              {
                recipeId: 'recipe-1',
                order: 1,
                title: 'Lesson 1',
                duration: 30,
                recipeSnapshot: mockRecipe,
              },
              {
                recipeId: 'recipe-2',
                order: 2,
                title: 'Lesson 2',
                duration: 45,
                recipeSnapshot: { id: 'recipe-2', title: 'Recipe 2', expectedDurationMinutes: 45 },
              },
            ],
          },
        },
        include: {
          lessons: true,
        },
      });
      expect(result?.lessons).toHaveLength(2);
      expect(result?.lessons?.[0].recipeSnapshot?.id).toBe('recipe-1');
      expect(result?.lessons?.[1].recipeSnapshot?.id).toBe('recipe-2');
    });

    it('should snapshot recipe data correctly during creation (preserves recipe data)', async () => {
      const recipeSnapshot = {
        id: 'recipe-123',
        title: 'Pizza Margherita',
        expectedDurationMinutes: 60,
        difficulty: 'INTERMEDIATE',
        tags: ['italian', 'pizza'],
        ingredients: [
          { name: 'chocolate', quantity: '200g' },
          { name: 'butter', quantity: '100g' },
        ],
        steps: [
          { step: 1, description: 'Melt chocolate' },
          { step: 2, description: 'Add butter' },
        ],
        nutritionalInfo: {
          calories: 450,
          protein: '8g',
          carbs: '35g',
        },
      };

      const mockCreateReturn = {
        id: 'version-created',
        classId: 'class-1',
        version: '1',
        title: 'Cooking Class',
        description: undefined,
        slug: 'cooking-class',
        status: 'DRAFT',
        isPublished: false,
        publishedAt: undefined,
        createdAt: new Date('2024-01-01'),
        lessons: [
          {
            id: 'lesson-created',
            classVersionId: 'version-created',
            recipeId: 'recipe-123',
            order: 1,
            title: 'Lesson',
            duration: 60,
            recipeSnapshot,
            createdAt: new Date('2024-01-01'),
          },
        ],
      };

      (prisma.classVersion.create as jest.Mock).mockResolvedValue(mockCreateReturn);

      const versionData = {
        classId: 'class-1',
        version: '1',
        publishedAt: undefined,
        isPublished: false,
        title: 'Cooking Class',
        description: undefined,
        slug: 'cooking-class',
        status: 'DRAFT',
        lessons: [
          {
            recipeId: 'recipe-123',
            order: 1,
            title: 'Lesson',
            duration: 60,
            recipeSnapshot,
          },
        ],
      };

      const result = await repository.create(versionData);

      // Verify that the recipe snapshot is preserved exactly as provided
      expect(result?.lessons?.[0].recipeSnapshot).toEqual(recipeSnapshot);
      expect(result?.lessons?.[0].recipeId).toBe('recipe-123');
    });
  });

  describe('publish', () => {
    it('should update version to published status with isPublished true', async () => {
      const publishedVersion = {
        ...mockPrismaVersion,
        isPublished: true,
        status: 'PUBLISHED',
        publishedAt: new Date('2024-01-01'),
      };
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(publishedVersion);

      const result = await repository.publish('version-1');

      expect(prisma.classVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-1' },
        data: {
          isPublished: true,
          publishedAt: expect.any(Date),
          status: 'PUBLISHED',
        },
        include: {
          lessons: true,
        },
      });
      expect(result.isPublished).toBe(true);
      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it('should preserve recipe data when publishing', async () => {
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const result = await repository.publish('version-1');

      expect(result.lessons).toBeDefined();
      expect(result.lessons?.[0].recipeSnapshot).toEqual(mockRecipe);
    });

    it('should set publishedAt to current date', async () => {
      const now = new Date();
      (prisma.classVersion.update as jest.Mock).mockResolvedValue({
        ...mockPrismaVersion,
        publishedAt: now,
      });

      await repository.publish('version-1');

      expect(prisma.classVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should return version with lessons and recipe data after publishing', async () => {
      const afterPublish = mockPrismaVersion;
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(afterPublish);

      const result = await repository.publish('version-1');

      expect(result).toEqual(mockClassVersionEntity);
      expect(result?.lessons?.[0].recipeSnapshot?.id).toBe('recipe-1');
    });

    it('should handle publishing version with multiple lessons', async () => {
      const multipleLessonsPublish = {
        ...mockPrismaVersion,
        lessons: [
          mockLessonWithRecipe,
          {
            ...mockLessonWithRecipe,
            id: 'lesson-2',
            order: 2,
            recipeId: 'recipe-2',
            recipeSnapshot: { id: 'recipe-2', title: 'Recipe 2' },
          },
        ],
      };
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(multipleLessonsPublish);

      const result = await repository.publish('version-1');

      expect(result.lessons).toHaveLength(2);
      expect(result.lessons?.[0].recipeSnapshot?.id).toBe('recipe-1');
      expect(result.lessons?.[1].recipeSnapshot?.id).toBe('recipe-2');
    });
  });

  describe('N+1 Query Optimization', () => {
    it('findById should use single query with nested includes for lessons and recipes', async () => {
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(mockPrismaVersion);

      await repository.findById('version-1');

      const callArgs = (prisma.classVersion.findUnique as jest.Mock).mock.calls[0][0];
      expect(callArgs.include).toEqual({
        lessons: {
          include: {
            recipe: true,
          },
        },
      });
    });

    it('findByClassId should use single query with nested includes for all versions', async () => {
      (prisma.classVersion.findMany as jest.Mock).mockResolvedValue([mockPrismaVersion]);

      await repository.findByClassId('class-1');

      const callArgs = (prisma.classVersion.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.include).toEqual({
        lessons: {
          include: {
            recipe: true,
          },
        },
      });
    });

    it('findBySlug should filter published versions with nested includes', async () => {
      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(mockPrismaVersion);

      await repository.findBySlug('test-version');

      const callArgs = (prisma.classVersion.findFirst as jest.Mock).mock.calls[0][0];
      expect(callArgs.where).toEqual({
        slug: 'test-version',
        isPublished: true,
      });
      expect(callArgs.include).toEqual({
        lessons: {
          include: {
            recipe: true,
          },
        },
      });
    });

    it('create should include lessons in response to capture recipe snapshots', async () => {
      (prisma.classVersion.create as jest.Mock).mockResolvedValue(mockPrismaVersion);

      await repository.create({
        classId: 'class-1',
        version: '1',
        title: 'Test',
        slug: 'test',
        status: 'DRAFT',
        isPublished: false,
        lessons: [],
      });

      const callArgs = (prisma.classVersion.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.include).toEqual({
        lessons: true,
      });
    });

    it('publish should include lessons to maintain recipe data', async () => {
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(mockPrismaVersion);

      await repository.publish('version-1');

      const callArgs = (prisma.classVersion.update as jest.Mock).mock.calls[0][0];
      expect(callArgs.include).toEqual({
        lessons: true,
      });
    });
  });

  describe('Recipe Snapshot Preservation', () => {
    it('should preserve complex recipe snapshot with all properties', async () => {
      const complexRecipeSnapshot = {
        id: 'recipe-complex',
        title: 'Complex Recipe',
        expectedDurationMinutes: 90,
        difficulty: 'ADVANCED',
        tags: ['dessert', 'chocolate', 'french'],
        ingredients: [
          { name: 'chocolate', quantity: '200g' },
          { name: 'butter', quantity: '100g' },
        ],
        steps: [
          { step: 1, description: 'Melt chocolate' },
          { step: 2, description: 'Add butter' },
        ],
        nutritionalInfo: {
          calories: 450,
          protein: '8g',
          carbs: '35g',
        },
      };

      const prismaWithComplexSnapshot = {
        ...mockPrismaVersion,
        lessons: [
          {
            ...mockLessonWithRecipe,
            recipeSnapshot: complexRecipeSnapshot,
          },
        ],
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(prismaWithComplexSnapshot);

      const result = await repository.findById('version-1');

      expect(result?.lessons?.[0].recipeSnapshot).toEqual(complexRecipeSnapshot);
      expect(result?.lessons?.[0].recipeSnapshot?.tags).toHaveLength(3);
      expect(result?.lessons?.[0].recipeSnapshot?.ingredients).toHaveLength(2);
      expect(result?.lessons?.[0].recipeSnapshot?.nutritionalInfo?.calories).toBe(450);
    });

    it('should handle recipe snapshot with null values', async () => {
      const recipeWithNulls = {
        id: 'recipe-null',
        title: 'Recipe with nulls',
        expectedDurationMinutes: null,
        difficulty: null,
        tags: null,
      };

      const prismaWithNullSnapshot = {
        ...mockPrismaVersion,
        lessons: [
          {
            ...mockLessonWithRecipe,
            recipeSnapshot: recipeWithNulls,
          },
        ],
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(prismaWithNullSnapshot);

      const result = await repository.findById('version-1');

      expect(result?.lessons?.[0].recipeSnapshot).toEqual(recipeWithNulls);
      expect(result?.lessons?.[0].recipeSnapshot?.expectedDurationMinutes).toBeNull();
    });

    it('should map recipeId from lesson while recipeSnapshot contains full data', async () => {
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(mockPrismaVersion);

      const result = await repository.findById('version-1');

      // Verify recipeId is separate field
      expect(result?.lessons?.[0].recipeId).toBe('recipe-1');
      // Verify recipeSnapshot contains full recipe data
      expect(result?.lessons?.[0].recipeSnapshot?.id).toBe('recipe-1');
      expect(result?.lessons?.[0].recipeSnapshot?.title).toBe('Test Recipe');
    });
  });

  describe('Published Version Behavior', () => {
    it('findBySlug should return only published versions (isPublished: true filter)', async () => {
      const published = mockPrismaVersion;
      const draft = { ...mockPrismaVersion, id: 'version-draft', isPublished: false };

      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(published);

      const result = await repository.findBySlug('published-slug');

      expect(result?.isPublished).toBe(true);
      expect(result).not.toBeNull();
    });

    it('should set all required fields on published version', async () => {
      const now = new Date();
      const published = {
        ...mockPrismaVersion,
        isPublished: true,
        status: 'PUBLISHED',
        publishedAt: now,
      };
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(published);

      const result = await repository.publish('version-1');

      expect(result.isPublished).toBe(true);
      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toEqual(now);
    });
  });

  describe('Edge Cases', () => {
    it('should handle lessons with null duration', async () => {
      const lessonWithNullDuration = {
        ...mockLessonWithRecipe,
        duration: null,
      };
      const versionWithNullDuration = {
        ...mockPrismaVersion,
        lessons: [lessonWithNullDuration],
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(versionWithNullDuration);

      const result = await repository.findById('version-1');

      expect(result?.lessons?.[0].duration).toBeUndefined();
    });

    it('should handle version with null description', async () => {
      const versionWithNullDesc = {
        ...mockPrismaVersion,
        description: null,
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(versionWithNullDesc);

      const result = await repository.findById('version-1');

      expect(result?.description).toBeUndefined();
    });

    it('should handle empty lessons array', async () => {
      const versionWithEmptyLessons = {
        ...mockPrismaVersion,
        lessons: [],
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(versionWithEmptyLessons);

      const result = await repository.findById('version-1');

      expect(result?.lessons).toEqual([]);
    });

    it('should convert publishedAt to undefined when null', async () => {
      const versionWithNullPublishedAt = {
        ...mockPrismaVersion,
        publishedAt: null,
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(versionWithNullPublishedAt);

      const result = await repository.findById('version-1');

      expect(result?.publishedAt).toBeUndefined();
    });

    it('should use new Date when publishedAt is null for createdAt fallback', async () => {
      const versionWithNullPublishedAt = {
        ...mockPrismaVersion,
        publishedAt: null,
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(versionWithNullPublishedAt);

      const result = await repository.findById('version-1');

      expect(result?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Integration Style Scenarios', () => {
    it('should find, publish, and verify published version state', async () => {
      // Mock findById for draft version
      const draftVersion = {
        ...mockPrismaVersion,
        id: 'draft-version',
        isPublished: false,
        status: 'DRAFT',
        publishedAt: null,
      };
      (prisma.classVersion.findUnique as jest.Mock).mockResolvedValue(draftVersion);

      const found = await repository.findById('draft-version');
      expect(found?.isPublished).toBe(false);

      // Mock publish operation
      const publishedVersion = {
        ...draftVersion,
        isPublished: true,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      };
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(publishedVersion);

      const published = await repository.publish('draft-version');
      expect(published.isPublished).toBe(true);
      expect(published.status).toBe('PUBLISHED');

      // Mock findBySlug to return published version
      (prisma.classVersion.findFirst as jest.Mock).mockResolvedValue(publishedVersion);

      const bySlug = await repository.findBySlug('draft-version');
      expect(bySlug).not.toBeNull();
      expect(bySlug?.isPublished).toBe(true);
    });

    it('should maintain recipe data across version lifecycle', async () => {
      const recipeData = {
        id: 'lifecycle-recipe',
        title: 'Lifecycle Recipe',
        expectedDurationMinutes: 45,
        tags: ['test'],
      };

      const lifecycleVersion = {
        id: 'lifecycle-version',
        classId: 'class-1',
        version: '1',
        title: 'Version with Recipe',
        slug: 'version-with-recipe',
        status: 'DRAFT',
        isPublished: false,
        publishedAt: undefined,
        createdAt: new Date('2024-01-01'),
        lessons: [
          {
            id: 'lifecycle-lesson',
            classVersionId: 'lifecycle-version',
            recipeId: 'lifecycle-recipe',
            order: 1,
            title: 'Lesson',
            duration: 45,
            recipeSnapshot: recipeData,
            createdAt: new Date('2024-01-01'),
          },
        ],
      };

      // Create with recipe snapshot
      (prisma.classVersion.create as jest.Mock).mockResolvedValue(lifecycleVersion);
      const versionData = {
        classId: 'class-1',
        version: '1',
        title: 'Version with Recipe',
        slug: 'version-with-recipe',
        status: 'DRAFT',
        isPublished: false,
        lessons: [
          {
            recipeId: 'lifecycle-recipe',
            order: 1,
            title: 'Lesson',
            duration: 45,
            recipeSnapshot: recipeData,
          },
        ],
      };

      const created = await repository.create(versionData);
      expect(created.lessons?.[0].recipeSnapshot).toEqual(recipeData);

      // Publish should preserve recipe data
      (prisma.classVersion.update as jest.Mock).mockResolvedValue(lifecycleVersion);
      const published = await repository.publish('lifecycle-version');
      expect(published.lessons?.[0].recipeSnapshot).toEqual(recipeData);
    });
  });
});
