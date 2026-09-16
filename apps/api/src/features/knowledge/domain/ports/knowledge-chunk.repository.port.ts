import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';

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
  /**
   * Server-side vector similarity search (pgvector cosine distance).
   *
   * Only chunks whose embedding dimension matches `queryEmbedding` are
   * considered (providers use mixed dimensions: 768 / 1536). Results are
   * ranked by descending similarity and capped at `limit` inside Postgres.
   * When `minSimilarityScore` is provided, chunks below it are excluded.
   */
  searchRelevantChunks(
    atomId: string,
    queryEmbedding: number[],
    limit: number,
    minSimilarityScore?: number,
  ): Promise<{ chunk: KnowledgeChunk; similarityScore: number }[]>;
}

export class KnowledgeChunkNotFoundError extends Error {
  readonly code = 'KNOWLEDGE_CHUNK_NOT_FOUND' as const;
  constructor(chunkId: string) {
    super(`KnowledgeChunk with id ${chunkId} not found`);
    this.name = 'KnowledgeChunkNotFoundError';
  }
}
