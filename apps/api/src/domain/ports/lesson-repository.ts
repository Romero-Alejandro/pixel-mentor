import type { Lesson, LessonChunk } from '@/domain/entities/lesson';

export interface LessonRepository {
  findById(id: string): Promise<Lesson | null>;

  findAll(): Promise<Lesson[]>;

  findActive(): Promise<Lesson[]>;

  create(lesson: Omit<Lesson, 'createdAt' | 'updatedAt'>): Promise<Lesson>;

  update(id: string, data: Partial<Lesson>): Promise<Lesson>;

  delete(id: string): Promise<void>;

  // Chunk-related methods for RAG
  findChunksByLessonId(lessonId: string): Promise<LessonChunk[]>;

  createChunk(chunk: Omit<LessonChunk, 'createdAt' | 'updatedAt'>): Promise<LessonChunk>;

  updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<LessonChunk>;

  findRelevantChunks(
    lessonId: string,
    queryEmbedding: number[],
    limit?: number,
  ): Promise<LessonChunk[]>;
}

export class LessonNotFoundError extends Error {
  readonly code = 'LESSON_NOT_FOUND' as const;
  readonly lessonId: string;

  constructor(lessonId: string) {
    super(`Lesson with ID ${lessonId} not found`);
    this.name = 'LessonNotFoundError';
    this.lessonId = lessonId;
  }
}

export class LessonInactiveError extends Error {
  readonly code = 'LESSON_INACTIVE' as const;
  readonly lessonId: string;

  constructor(lessonId: string) {
    super(`Lesson with ID ${lessonId} is not active`);
    this.name = 'LessonInactiveError';
    this.lessonId = lessonId;
  }
}

export async function getLessonOrError(
  repository: LessonRepository,
  id: string,
  requiresActive: boolean = true,
): Promise<Lesson> {
  const lesson = await repository.findById(id);

  if (!lesson) {
    throw new LessonNotFoundError(id);
  }

  if (requiresActive && !lesson.active) {
    throw new LessonInactiveError(id);
  }

  return lesson;
}
