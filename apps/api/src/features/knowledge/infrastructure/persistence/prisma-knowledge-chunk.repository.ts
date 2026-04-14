import type { KnowledgeChunk } from '../../domain/entities/knowledge-chunk.entity.js';
import type { KnowledgeChunkRepository } from '../../domain/ports/knowledge-chunk.repository.port.js';

import { prisma } from '@/database/client.js';

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
    const raw = await prisma.knowledgeChunk.create({
      data: {
        atomId: chunk.atomId,
        index: chunk.index,
        chunkText: chunk.chunkText,
        embedding: chunk.embedding as any,
        tsvector: chunk.tsvector,
        version: chunk.version,
        isImmutable: chunk.isImmutable,
      },
    });
    return this.mapChunk(raw);
  }

  async updateEmbedding(chunkId: string, embedding: number[]): Promise<KnowledgeChunk> {
    const raw = await prisma.knowledgeChunk.update({
      where: { id: chunkId },
      data: { embedding: embedding as any },
    });
    return this.mapChunk(raw);
  }

  async delete(chunkId: string): Promise<void> {
    await prisma.knowledgeChunk.delete({ where: { id: chunkId } });
  }

  async findRelevantChunks(
    atomId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<{ chunk: KnowledgeChunk; similarityScore: number }[]> {
    // En MVP: recuperar todos los chunks del atom y ordenar por similitud coseno en memoria
    const chunks = await this.findByAtomId(atomId);

    const scored = chunks
      .filter((chunk) => chunk.embedding)
      .map((chunk) => ({
        chunk,
        similarityScore: this.cosineSimilarity(queryEmbedding, chunk.embedding!),
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    return scored;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private mapChunk(raw: any): KnowledgeChunk {
    return {
      id: raw.id,
      atomId: raw.atomId,
      index: raw.index,
      chunkText: raw.chunkText,
      embedding: raw.embedding,
      tsvector: raw.tsvector,
      version: raw.version,
      isImmutable: raw.isImmutable,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
