export interface KnowledgeChunk {
  readonly id: string;
  readonly atomId: string;
  readonly index: number;
  readonly chunkText: string;
  readonly embedding?: number[] | null;
  readonly tsvector?: string | null;
  readonly version: number;
  readonly isImmutable: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createKnowledgeChunk(parameters: {
  id: string;
  atomId: string;
  index: number;
  chunkText: string;
  embedding?: number[] | null;
  version?: number;
}): KnowledgeChunk {
  const now = new Date();
  return {
    id: parameters.id,
    atomId: parameters.atomId,
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

export function updateEmbedding(chunk: KnowledgeChunk, embedding: number[]): KnowledgeChunk {
  if (!chunk.isImmutable) {
    throw new Error('Cannot modify immutable chunk');
  }
  return {
    ...chunk,
    embedding,
    updatedAt: new Date(),
  };
}
