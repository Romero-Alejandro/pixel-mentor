import { cosineSimilarity } from '@/utils/ai-utils.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import { RAG_CONFIG } from '@/domain/ports/rag-service.js';
import type { KnowledgeChunk } from '@/domain/entities/knowledge-chunk.js';
import type { KnowledgeChunkRepository } from '@/domain/ports/knowledge-chunk-repository.js';

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

    const rawChunks = await this.knowledgeChunkRepository.findRelevantChunks(
      query.atomId,
      embedding,
      k,
    );

    const retrieved = rawChunks
      .filter((item) => item.chunk.embedding)
      .map((item) => ({
        chunk: item.chunk,
        similarityScore: cosineSimilarity(embedding, item.chunk.embedding!),
        citations: [],
      }))
      .filter((item) => item.similarityScore >= RAG_CONFIG.MIN_SIMILARITY_SCORE)
      .sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      chunks: retrieved,
      totalAvailable: retrieved.length,
      retrievalMethod: 'embedding',
    };
  }
}
