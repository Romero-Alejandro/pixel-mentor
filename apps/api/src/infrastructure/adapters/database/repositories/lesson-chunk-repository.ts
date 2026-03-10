import { LessonChunk } from '@/domain/entities/lesson-chunk.js';
import { prisma } from '../client.js';
import {
  LessonChunkNotFoundError,
  LessonChunkRepository,
} from '@/domain/ports/lesson-chunk-repository.js';
import { handlePrismaError } from '../error-handler.js';

type PrismaLessonChunk = NonNullable<Awaited<ReturnType<typeof prisma.lessonChunk.findUnique>>>;

const mapLessonChunkToDomain = (entity: PrismaLessonChunk): LessonChunk => ({
  id: entity.id,
  lessonId: entity.lessonId,
  index: entity.index,
  chunkText: entity.chunkText,
  embedding: entity.embedding as number[] | null,
  tsvector: entity.tsvector,
  version: entity.version,
  isImmutable: entity.isImmutable,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

export class PrismaLessonChunkRepository implements LessonChunkRepository {
  async findById(id: string): Promise<LessonChunk | null> {
    const chunk = await prisma.lessonChunk.findUnique({ where: { id } });
    return chunk ? mapLessonChunkToDomain(chunk) : null;
  }

  async findByLessonId(lessonId: string): Promise<LessonChunk[]> {
    const chunks = await prisma.lessonChunk.findMany({
      where: { lessonId },
      orderBy: { index: 'asc' },
    });
    return chunks.map(mapLessonChunkToDomain);
  }

  async create(chunk: Omit<LessonChunk, 'createdAt' | 'updatedAt'>): Promise<LessonChunk> {
    const created = await prisma.lessonChunk.create({
      data: {
        id: chunk.id,
        lessonId: chunk.lessonId,
        index: chunk.index,
        chunkText: chunk.chunkText,
        embedding: chunk.embedding as unknown as any,
        tsvector: chunk.tsvector,
        version: chunk.version,
        isImmutable: chunk.isImmutable,
      },
    });
    return mapLessonChunkToDomain(created);
  }

  async updateEmbedding(chunkId: string, embedding: number[]): Promise<LessonChunk> {
    try {
      const updated = await prisma.lessonChunk.update({
        where: { id: chunkId },
        data: { embedding: embedding as unknown as any },
      });
      return mapLessonChunkToDomain(updated);
    } catch (error) {
      handlePrismaError(error, LessonChunkNotFoundError, chunkId);
    }
  }

  async findRelevantChunks(
    lessonId: string,
    _queryEmbedding: number[],
    limit?: number,
  ): Promise<LessonChunk[]> {
    const chunks = await prisma.lessonChunk.findMany({
      where: { lessonId, embedding: { not: null as unknown as any } },
      orderBy: { index: 'asc' },
      take: limit ?? 3,
    });
    return chunks.map(mapLessonChunkToDomain);
  }
}
