import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';

export interface RAGService {
  retrieveChunks(query: {
    atomId: string;
    queryText?: string;
    queryEmbedding?: number[];
    k?: number;
  }): Promise<{
    chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: unknown[] }[];
    totalAvailable: number;
    retrievalMethod: string;
  }>;
  generateEmbedding(text: string): Promise<number[]>;
}

export const RAG_CONFIG = {
  DEFAULT_K: 5,
  MIN_SIMILARITY_SCORE: 0.75,
};
