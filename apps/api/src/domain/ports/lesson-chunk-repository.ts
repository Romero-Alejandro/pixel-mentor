import type { LessonChunk } from '@/domain/entities/lesson-chunk';

export interface LessonChunkRepository {
  findById(id: string): Promise<LessonChunk | null>;

  findByLessonId(lessonId: string): Promise<LessonChunk[]>;

  create(chunk: Omit<LessonChunk, 'createdAt' | 'updatedAt'>): Promise<LessonChunk>;

  updateEmbedding(chunkId: string, embedding: number[]): Promise<LessonChunk>;

  findRelevantChunks(
    lessonId: string,
    queryEmbedding: number[],
    limit?: number,
  ): Promise<LessonChunk[]>;
}

export class LessonChunkNotFoundError extends Error {
  readonly code = 'CHUNK_NOT_FOUND' as const;
  readonly chunkId: string;

  constructor(chunkId: string) {
    super(`Lesson chunk with ID ${chunkId} not found`);
    this.name = 'LessonChunkNotFoundError';
    this.chunkId = chunkId;
  }
}
