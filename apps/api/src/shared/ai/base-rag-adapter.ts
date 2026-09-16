import type { RAGService } from '@/features/recipe/domain/ports/rag-service.port.js';
import { RAG_CONFIG } from '@/features/recipe/domain/ports/rag-service.port.js';
import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';
import type { KnowledgeChunkRepository } from '@/features/knowledge/domain/ports/knowledge-chunk.repository.port.js';

export abstract class BaseRAGAdapter implements RAGService {
  constructor(protected readonly knowledgeChunkRepository: KnowledgeChunkRepository) {}

  abstract generateEmbedding(text: string): Promise<number[]>;

  async retrieveChunks(query: {
    atomId: string;
    queryText?: string;
    queryEmbedding?: number[];
    k?: number;
  }): Promise<{
    chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[];
    totalAvailable: number;
    retrievalMethod: string;
  }> {
    const embedding = query.queryEmbedding ?? (await this.generateEmbedding(query.queryText ?? ''));
    const k = query.k ?? RAG_CONFIG.DEFAULT_K;

    // Server-side vector search: ranking, similarity threshold and limit all
    // happen in Postgres (pgvector `<=>`). This replaces the previous flow that
    // re-scored every chunk in JS after the repository already did.
    const retrieved = await this.knowledgeChunkRepository.searchRelevantChunks(
      query.atomId,
      embedding,
      k,
      RAG_CONFIG.MIN_SIMILARITY_SCORE,
    );

    return {
      chunks: retrieved.map((item) => ({
        chunk: item.chunk,
        similarityScore: item.similarityScore,
        citations: [],
      })),
      totalAvailable: retrieved.length,
      retrievalMethod: 'embedding',
    };
  }
}
