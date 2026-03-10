import type { LessonChunk } from '@/domain/entities/lesson-chunk';

export interface RetrievalQuery {
  readonly lessonId: string;
  readonly queryText: string;
  readonly queryEmbedding?: number[];
  readonly k?: number; // Number of chunks to retrieve (default: 3)
}

export interface RetrievedChunk {
  readonly chunk: LessonChunk;
  readonly similarityScore: number;
  readonly citations: readonly string[];
}

export interface RAGRetrievalResult {
  readonly chunks: readonly RetrievedChunk[];
  readonly totalAvailable: number;
  readonly retrievalMethod: 'embedding' | 'tsvector' | 'hybrid';
}

export interface RAGService {
  retrieveChunks(query: RetrievalQuery): Promise<RAGRetrievalResult>;

  generateEmbedding(text: string): Promise<number[]>;
}

export interface ChunkIngestionJob {
  readonly lessonId: string;
  readonly chunkText: string;
  readonly index: number;
  readonly chunkId: string;
}

export interface EmbeddingGenerator {
  generateEmbedding(text: string): Promise<number[]>;
}

export class RAGRetrievalError extends Error {
  readonly code = 'RAG_RETRIEVAL_ERROR' as const;
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'RAGRetrievalError';
    this.originalError = originalError;
  }
}

export class EmbeddingGenerationError extends Error {
  readonly code = 'EMBEDDING_GENERATION_ERROR' as const;
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'EmbeddingGenerationError';
    this.originalError = originalError;
  }
}

// Constants for RAG configuration
export const RAG_CONFIG = {
  DEFAULT_K: 3,
  MIN_SIMILARITY_SCORE: 0.5,
  CHUNK_TOKEN_RANGE: { min: 200, max: 600 },
} as const;
