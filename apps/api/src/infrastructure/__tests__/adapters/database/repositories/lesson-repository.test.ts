import { PrismaLessonRepository } from '@/infrastructure/adapters/database/repositories/lesson-repository';

jest.mock('@/infrastructure/adapters/database/client', () => {
  const mocks = {
    leccion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lessonChunk: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return { prisma: mocks };
});

import { prisma } from '@/infrastructure/adapters/database/client';
const mockPrisma = prisma as any;

describe('PrismaLessonRepository', () => {
  let repository: PrismaLessonRepository;

  beforeEach(() => {
    // Clear all mocks
    mockPrisma.leccion.findUnique.mockClear();
    mockPrisma.leccion.findMany.mockClear();
    mockPrisma.leccion.create.mockClear();
    mockPrisma.leccion.update.mockClear();
    mockPrisma.leccion.delete.mockClear();
    mockPrisma.lessonChunk.findMany.mockClear();
    mockPrisma.lessonChunk.create.mockClear();
    mockPrisma.lessonChunk.update.mockClear();

    repository = new PrismaLessonRepository();
  });

  it('should find a lesson by ID', async () => {
    const mockLesson = {
      id: 'lesson-1',
      titulo: 'Test Lesson',
      descripcion: 'Test Description',
      conceptos: [],
      analogias: [],
      erroresComunes: [],
      explicacionBase: 'Test Explanation',
      activa: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      preguntas: [],
      chunks: [],
    };

    mockPrisma.leccion.findUnique.mockResolvedValue(mockLesson);

    const result = await repository.findById('lesson-1');

    expect(result).toEqual({
      id: 'lesson-1',
      title: 'Test Lesson',
      description: 'Test Description',
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'Test Explanation',
      active: true,
      createdAt: mockLesson.createdAt,
      updatedAt: mockLesson.updatedAt,
      questions: [],
      chunks: [],
    });

    expect(mockPrisma.leccion.findUnique).toHaveBeenCalledWith({
      where: { id: 'lesson-1' },
      include: {
        preguntas: { orderBy: { orden: 'asc' } },
        chunks: { orderBy: { index: 'asc' } },
      },
    });
  });

  it('should return null if lesson not found', async () => {
    mockPrisma.leccion.findUnique.mockResolvedValue(null);

    const result = await repository.findById('non-existent-id');
    expect(result).toBeNull();
  });

  it('should find all lessons', async () => {
    const mockLessons = [
      {
        id: 'lesson-1',
        titulo: 'Test Lesson 1',
        descripcion: 'Test Description 1',
        conceptos: [],
        analogias: [],
        erroresComunes: [],
        explicacionBase: 'Test Explanation 1',
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        preguntas: [],
        chunks: [],
      },
      {
        id: 'lesson-2',
        titulo: 'Test Lesson 2',
        descripcion: 'Test Description 2',
        conceptos: [],
        analogias: [],
        erroresComunes: [],
        explicacionBase: 'Test Explanation 2',
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        preguntas: [],
        chunks: [],
      },
    ];

    mockPrisma.leccion.findMany.mockResolvedValue(mockLessons);

    const result = await repository.findAll();

    expect(result).toEqual([
      {
        id: 'lesson-1',
        title: 'Test Lesson 1',
        description: 'Test Description 1',
        concepts: [],
        analogies: [],
        commonErrors: [],
        baseExplanation: 'Test Explanation 1',
        active: true,
        createdAt: mockLessons[0].createdAt,
        updatedAt: mockLessons[0].updatedAt,
        questions: [],
        chunks: [],
      },
      {
        id: 'lesson-2',
        title: 'Test Lesson 2',
        description: 'Test Description 2',
        concepts: [],
        analogies: [],
        commonErrors: [],
        baseExplanation: 'Test Explanation 2',
        active: true,
        createdAt: mockLessons[1].createdAt,
        updatedAt: mockLessons[1].updatedAt,
        questions: [],
        chunks: [],
      },
    ]);

    expect(mockPrisma.leccion.findMany).toHaveBeenCalled();
  });

  it('should find active lessons', async () => {
    const mockLessons = [
      {
        id: 'lesson-1',
        titulo: 'Test Lesson 1',
        descripcion: 'Test Description 1',
        conceptos: [],
        analogias: [],
        erroresComunes: [],
        explicacionBase: 'Test Explanation 1',
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        preguntas: [],
        chunks: [],
      },
    ];

    mockPrisma.leccion.findMany.mockResolvedValue(mockLessons);

    const result = await repository.findActive();

    expect(result).toEqual([
      {
        id: 'lesson-1',
        title: 'Test Lesson 1',
        description: 'Test Description 1',
        concepts: [],
        analogies: [],
        commonErrors: [],
        baseExplanation: 'Test Explanation 1',
        active: true,
        createdAt: mockLessons[0].createdAt,
        updatedAt: mockLessons[0].updatedAt,
        questions: [],
        chunks: [],
      },
    ]);

    expect(mockPrisma.leccion.findMany).toHaveBeenCalledWith({
      where: { activa: true },
    });
  });
});
