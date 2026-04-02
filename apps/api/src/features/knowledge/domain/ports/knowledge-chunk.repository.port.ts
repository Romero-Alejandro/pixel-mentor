import type { KnowledgeChunk } from '../entities/knowledge-chunk.entity.js';

export interface KnowledgeChunkRepository {
  findByAtomId(atomId: string): Promise<KnowledgeChunk[]>;
  findByAtomIdOrdered(atomId: string): Promise<KnowledgeChunk[]>;
  findById(id: string): Promise<KnowledgeChunk | null>;
  create(chunk: Omit<KnowledgeChunk, 'createdAt' | 'updatedAt'>): Promise<KnowledgeChunk>;
  updateEmbedding(chunkId: string, embedding: number[]): Promise<KnowledgeChunk>;
  delete(chunkId: string): Promise<void>;
  findRelevantChunks(
    atomId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<{ chunk: KnowledgeChunk; similarityScore: number }[]>;
}

export class KnowledgeChunkNotFoundError extends Error {
  readonly code = 'KNOWLEDGE_CHUNK_NOT_FOUND' as const;
  constructor(chunkId: string) {
    super(`KnowledgeChunk with id ${chunkId} not found`);
    this.name = 'KnowledgeChunkNotFoundError';
  }
}
