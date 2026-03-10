export interface LessonChunk {
  readonly id: string;
  readonly lessonId: string;
  readonly index: number;
  readonly chunkText: string;
  readonly embedding: number[] | null;
  readonly tsvector: string | null;
  readonly version: number;
  readonly isImmutable: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createLessonChunk(parameters: {
  id: string;
  lessonId: string;
  index: number;
  chunkText: string;
  embedding?: number[] | null;
  version?: number;
}): LessonChunk {
  const now = new Date();
  return {
    id: parameters.id,
    lessonId: parameters.lessonId,
    index: parameters.index,
    chunkText: parameters.chunkText,
    embedding: parameters.embedding ?? null,
    tsvector: null,
    version: parameters.version ?? 1,
    isImmutable: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateEmbedding(chunk: LessonChunk, embedding: number[]): LessonChunk {
  if (!chunk.isImmutable) {
    throw new Error('Cannot modify immutable chunk');
  }
  return {
    ...chunk,
    embedding,
    updatedAt: new Date(),
  };
}
