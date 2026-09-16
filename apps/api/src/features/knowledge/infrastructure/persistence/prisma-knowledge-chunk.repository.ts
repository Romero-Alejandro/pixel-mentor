import { prisma } from '@/database/client.js';
import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';
import type { KnowledgeChunkRepository } from '@/features/knowledge/domain/ports/knowledge-chunk.repository.port.js';

/** Flat shape returned by Prisma's query builder for knowledgeChunk rows. */
interface KnowledgeChunkRow {
  id: string;
  atomId: string;
  index: number;
  chunkText: string;
  // The vector column is Unsupported (excluded from generated payload types);
  // read via raw SQL it arrives as pgvector's text form.
  embedding?: unknown;
  tsvector: string | null;
  version: number;
  isImmutable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Row shape returned by searchRelevantChunks (embedding as pgvector text). */
interface RawChunkSearchRow {
  id: string;
  atomId: string;
  index: number;
  chunkText: string;
  embeddingText: string | null;
  tsvector: string | null;
  version: number;
  isImmutable: boolean;
  createdAt: Date;
  updatedAt: Date;
  distance: number;
}

/**
 * Parses pgvector's text representation ('[0.1,0.2,...]') into a numeric array.
 * Vector values are float32, so precision beyond ~7 significant digits is not
 * preserved — inherent to pgvector storage, and irrelevant for similarity.
 */
function parseVectorText(raw: string | null): number[] | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const parts = trimmed.slice(1, -1).trim();
  if (parts.length === 0) return null;
  return parts.split(',').map((v) => Number(v));
}

export class PrismaKnowledgeChunkRepository implements KnowledgeChunkRepository {
  async findByAtomId(atomId: string): Promise<KnowledgeChunk[]> {
    const raw = await prisma.knowledgeChunk.findMany({ where: { atomId } });
    return raw.map(this.mapChunk);
  }

  async findByAtomIdOrdered(atomId: string): Promise<KnowledgeChunk[]> {
    const raw = await prisma.knowledgeChunk.findMany({
      where: { atomId },
      orderBy: { index: 'asc' },
    });
    return raw.map(this.mapChunk);
  }

  async findById(id: string): Promise<KnowledgeChunk | null> {
    const raw = await prisma.knowledgeChunk.findUnique({ where: { id } });
    return raw ? this.mapChunk(raw) : null;
  }

  async create(chunk: Omit<KnowledgeChunk, 'createdAt' | 'updatedAt'>): Promise<KnowledgeChunk> {
    // `embedding` is an Unsupported("vector") column: the query builder cannot
    // bind it, so the insert goes through raw SQL with a $queryRaw-type safe
    // template. pgvector accepts its text form ('[1,2,3]') as a parameter.
    const raw = await prisma.$queryRaw<KnowledgeChunkRow[]>`
      INSERT INTO "knowledge_chunks"
        ("id", "atomId", "index", "chunkText", "embedding", "tsvector", "version", "isImmutable")
      VALUES
        (${chunk.id}, ${chunk.atomId}, ${chunk.index}, ${chunk.chunkText},
         ${this.toVectorParam(chunk.embedding)}, ${chunk.tsvector}, ${chunk.version}, ${chunk.isImmutable})
      RETURNING "id", "atomId", "index", "chunkText", "embedding"::text AS "embedding",
                "tsvector", "version", "isImmutable", "createdAt", "updatedAt"
    `;
    return this.mapRawRow(raw[0]!);
  }

  async updateEmbedding(chunkId: string, embedding: number[]): Promise<KnowledgeChunk> {
    const raw = await prisma.$queryRaw<KnowledgeChunkRow[]>`
      UPDATE "knowledge_chunks"
      SET "embedding" = ${this.toVectorParam(embedding)}, "updatedAt" = NOW()
      WHERE "id" = ${chunkId}
      RETURNING "id", "atomId", "index", "chunkText", "embedding"::text AS "embedding",
                "tsvector", "version", "isImmutable", "createdAt", "updatedAt"
    `;
    const row = raw[0];
    if (!row) {
      throw new Error(`KnowledgeChunk with id ${chunkId} not found`);
    }
    return this.mapRawRow(row);
  }

  async delete(chunkId: string): Promise<void> {
    await prisma.knowledgeChunk.delete({ where: { id: chunkId } });
  }

  async findRelevantChunks(
    atomId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<{ chunk: KnowledgeChunk; similarityScore: number }[]> {
    const results = await this.searchRelevantChunks(atomId, queryEmbedding, limit);
    return results.map((r) => ({ chunk: r.chunk, similarityScore: r.similarityScore }));
  }

  /**
   * Server-side vector search with pgvector's cosine distance operator (<=>).
   *
   * Replaces the previous MVP approach of loading every chunk + full embedding
   * of the atom and computing cosine similarity in a JS loop (O(n·d) per query
   * with the whole embedding payload moved over the wire). The comparison now
   * runs inside Postgres, ranked and limited there, and can use the HNSW index
   * when the engine supports it.
   */
  async searchRelevantChunks(
    atomId: string,
    queryEmbedding: number[],
    limit: number,
    minSimilarityScore?: number,
  ): Promise<{ chunk: KnowledgeChunk; similarityScore: number }[]> {
    if (queryEmbedding.length === 0 || limit <= 0) return [];
    const queryVector = this.toVectorParam(queryEmbedding);

    if (minSimilarityScore === undefined) {
      const rows = await prisma.$queryRaw<RawChunkSearchRow[]>`
        SELECT "id", "atomId", "index", "chunkText",
               "embedding"::text AS "embeddingText",
               "tsvector", "version", "isImmutable", "createdAt", "updatedAt",
               ("embedding" <=> ${queryVector}) AS "distance"
        FROM "knowledge_chunks"
        WHERE "atomId" = ${atomId}
          AND "embedding" IS NOT NULL
          AND vector_dims("embedding") = ${queryEmbedding.length}
        ORDER BY "distance" ASC, "index" ASC
        LIMIT ${limit}
      `;
      return rows.map((row) => ({
        chunk: this.mapRawRow(row, row.embeddingText),
        similarityScore: 1 - row.distance,
      }));
    }

    const rows = await prisma.$queryRaw<RawChunkSearchRow[]>`
      SELECT "id", "atomId", "index", "chunkText",
             "embedding"::text AS "embeddingText",
             "tsvector", "version", "isImmutable", "createdAt", "updatedAt",
             ("embedding" <=> ${queryVector}) AS "distance"
      FROM "knowledge_chunks"
      WHERE "atomId" = ${atomId}
        AND "embedding" IS NOT NULL
        AND vector_dims("embedding") = ${queryEmbedding.length}
        AND (1 - ("embedding" <=> ${queryVector})) >= ${minSimilarityScore}
      ORDER BY "distance" ASC, "index" ASC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      chunk: this.mapRawRow(row, row.embeddingText),
      similarityScore: 1 - row.distance,
    }));
  }

  /** number[] → pgvector text literal parameter ('[1,2,3]'); null for empty. */
  private toVectorParam(embedding: readonly number[] | null | undefined): string | null {
    if (!embedding || embedding.length === 0) return null;
    return `[${embedding.join(',')}]`;
  }

  /** Maps a query-builder row to the domain entity. */
  private mapChunk(raw: KnowledgeChunkRow): KnowledgeChunk {
    return {
      id: raw.id,
      atomId: raw.atomId,
      index: raw.index,
      chunkText: raw.chunkText,
      embedding: Array.isArray(raw.embedding)
        ? raw.embedding.map((v) => Number(v))
        : parseVectorText(typeof raw.embedding === 'string' ? raw.embedding : null),
      tsvector: raw.tsvector,
      version: raw.version,
      isImmutable: raw.isImmutable,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /** Maps a raw SQL row (embedding received as pgvector text) to the entity. */
  private mapRawRow(
    raw: {
      id: string;
      atomId: string;
      index: number;
      chunkText: string;
      tsvector: string | null;
      version: number;
      isImmutable: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    embeddingText?: string | null,
  ): KnowledgeChunk {
    return {
      id: raw.id,
      atomId: raw.atomId,
      index: raw.index,
      chunkText: raw.chunkText,
      embedding: parseVectorText(embeddingText ?? null),
      tsvector: raw.tsvector,
      version: raw.version,
      isImmutable: raw.isImmutable,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
