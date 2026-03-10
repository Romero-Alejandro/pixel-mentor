import type { LessonRepository } from '@/domain/ports/lesson-repository';
import {
  LessonNotFoundError,
  LessonInactiveError,
  getLessonOrError,
} from '@/domain/ports/lesson-repository';
import { createLesson } from '@/domain/entities/lesson';

class MockLessonRepository implements LessonRepository {
  private lessons: any[] = [];

  async findById(id: string): Promise<any | null> {
    return this.lessons.find((l) => l.id === id) || null;
  }

  async findAll(): Promise<any[]> {
    return this.lessons;
  }

  async findActive(): Promise<any[]> {
    return this.lessons.filter((l) => l.active);
  }

  async create(lesson: any): Promise<any> {
    this.lessons.push(lesson);
    return lesson;
  }

  async update(id: string, data: any): Promise<any> {
    const index = this.lessons.findIndex((l) => l.id === id);
    if (index !== -1) {
      this.lessons[index] = { ...this.lessons[index], ...data };
    }
    return this.lessons[index];
  }

  async delete(id: string): Promise<void> {
    this.lessons = this.lessons.filter((l) => l.id !== id);
  }

  async findChunksByLessonId(_lessonId: string): Promise<any[]> {
    return [];
  }

  async createChunk(chunk: any): Promise<any> {
    return chunk;
  }

  async updateChunkEmbedding(_chunkId: string, _embedding: number[]): Promise<any> {
    return { id: _chunkId, embedding: _embedding };
  }

  async findRelevantChunks(
    _lessonId: string,
    _queryEmbedding: number[],
    _limit?: number,
  ): Promise<any[]> {
    return [];
  }
}

describe('LessonRepository', () => {
  let repository: MockLessonRepository;

  beforeEach(() => {
    repository = new MockLessonRepository();
  });

  it('should save and retrieve a lesson', async () => {
    const lesson = createLesson({
      id: 'lesson-123',
      title: 'Math Basics',
      description: 'Introduction to addition',
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'Addition is the process of combining two numbers',
      questions: [],
      chunks: [],
      active: true,
    });

    await repository.create(lesson);
    const retrieved = await repository.findById('lesson-123');

    expect(retrieved).not.toBeNull();
    expect(retrieved.id).toBe('lesson-123');
    expect(retrieved.title).toBe('Math Basics');
  });

  it('should find lessons by subject', async () => {
    const mathLesson = createLesson({
      id: 'lesson-1',
      title: 'Math Basics',
      description: 'Introduction to addition',
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'Addition is the process of combining two numbers',
      questions: [],
      chunks: [],
      active: true,
    });

    const scienceLesson = createLesson({
      id: 'lesson-2',
      title: 'Science Basics',
      description: 'Introduction to physics',
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'Physics is the study of matter and energy',
      questions: [],
      chunks: [],
      active: true,
    });

    await repository.create(mathLesson);
    await repository.create(scienceLesson);

    const allLessons = await repository.findAll();
    expect(allLessons.length).toBe(2);
  });

  it('should throw LessonNotFoundError when lesson not found', async () => {
    await expect(getLessonOrError(repository, 'non-existent-id')).rejects.toThrow(
      LessonNotFoundError,
    );
  });

  it('should throw LessonInactiveError when lesson is inactive', async () => {
    const inactiveLesson = createLesson({
      id: 'lesson-inactive',
      title: 'Inactive Lesson',
      description: 'This lesson is inactive',
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'This lesson is inactive',
      questions: [],
      chunks: [],
      active: false,
    });

    await repository.create(inactiveLesson);
    await expect(getLessonOrError(repository, 'lesson-inactive')).rejects.toThrow(
      LessonInactiveError,
    );
  });
});
