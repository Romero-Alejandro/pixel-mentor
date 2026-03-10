import type { Analogy, CommonError, Concept, Lesson, Question } from '@/domain/entities/lesson';
import type { LessonChunk } from '@/domain/entities/lesson-chunk';
import type { LessonRepository } from '@/domain/ports/lesson-repository';
import { prisma } from '../client';

type PrismaLesson = NonNullable<Awaited<ReturnType<typeof prisma.leccion.findUnique>>>;
type PrismaLessonChunk = NonNullable<Awaited<ReturnType<typeof prisma.lessonChunk.findFirst>>>;

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

const mapLessonToDomain = (entity: PrismaLesson): Lesson => {
  const preguntas =
    'preguntas' in entity && Array.isArray(entity.preguntas) ? entity.preguntas : [];
  const chunks = 'chunks' in entity && Array.isArray(entity.chunks) ? entity.chunks : [];

  return {
    id: entity.id,
    title: entity.titulo,
    description: entity.descripcion,
    concepts: Object.freeze([...((entity.conceptos as unknown as Concept[]) ?? [])]),
    analogies: Object.freeze([...((entity.analogias as unknown as Analogy[]) ?? [])]),
    commonErrors: Object.freeze([...((entity.erroresComunes as unknown as CommonError[]) ?? [])]),
    baseExplanation: entity.explicacionBase,
    questions: Object.freeze(
      preguntas.map(
        (p: any): Question => ({
          id: p.id,
          lessonId: p.leccionId,
          text: p.texto,
          expectedAnswer: p.respuestaOk,
          feedbackExplanation: p.explicacion ?? undefined,
          multipleChoiceOptions: undefined,
          order: p.orden,
        }),
      ),
    ),
    chunks: Object.freeze(chunks.map((c: any) => mapLessonChunkToDomain(c))),
    active: entity.activa,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export class PrismaLessonRepository implements LessonRepository {
  async findById(id: string): Promise<Lesson | null> {
    const lesson = await prisma.leccion.findUnique({
      where: { id },
      include: {
        preguntas: { orderBy: { orden: 'asc' } },
        chunks: { orderBy: { index: 'asc' } },
      },
    });
    return lesson ? mapLessonToDomain(lesson) : null;
  }

  async findAll(): Promise<Lesson[]> {
    const lessons = await prisma.leccion.findMany();
    return lessons.map(mapLessonToDomain);
  }

  async findActive(): Promise<Lesson[]> {
    const lessons = await prisma.leccion.findMany({ where: { activa: true } });
    return lessons.map(mapLessonToDomain);
  }

  async create(lesson: Omit<Lesson, 'createdAt' | 'updatedAt'>): Promise<Lesson> {
    const created = await prisma.leccion.create({
      data: {
        id: lesson.id,
        titulo: lesson.title,
        descripcion: lesson.description,
        conceptos: lesson.concepts as unknown as any,
        analogias: lesson.analogies as unknown as any,
        erroresComunes: lesson.commonErrors as unknown as any,
        explicacionBase: lesson.baseExplanation,
        activa: lesson.active,
      },
    });
    return mapLessonToDomain(created);
  }

  async update(id: string, data: Partial<Lesson>): Promise<Lesson> {
    const updateData: Record<string, any> = {};

    if (data.title !== undefined) updateData.titulo = data.title;
    if (data.description !== undefined) updateData.descripcion = data.description;
    if (data.baseExplanation !== undefined) updateData.explicacionBase = data.baseExplanation;
    if (data.active !== undefined) updateData.activa = data.active;
    if (data.concepts !== undefined) updateData.conceptos = data.concepts as unknown as any;
    if (data.analogies !== undefined) updateData.analogias = data.analogies as unknown as any;
    if (data.commonErrors !== undefined)
      updateData.erroresComunes = data.commonErrors as unknown as any;

    const updated = await prisma.leccion.update({
      where: { id },
      data: updateData,
    });
    return mapLessonToDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.leccion.delete({ where: { id } });
  }

  async findChunksByLessonId(lessonId: string): Promise<LessonChunk[]> {
    const chunks = await prisma.lessonChunk.findMany({
      where: { lessonId },
      orderBy: { index: 'asc' },
    });
    return chunks.map(mapLessonChunkToDomain);
  }

  async createChunk(chunk: Omit<LessonChunk, 'createdAt' | 'updatedAt'>): Promise<LessonChunk> {
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

  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<LessonChunk> {
    const updated = await prisma.lessonChunk.update({
      where: { id: chunkId },
      data: { embedding: embedding as unknown as any },
    });
    return mapLessonChunkToDomain(updated);
  }

  async findRelevantChunks(
    lessonId: string,
    _queryEmbedding: number[],
    limit: number = 3,
  ): Promise<LessonChunk[]> {
    const chunks = await prisma.lessonChunk.findMany({
      where: { lessonId, embedding: { not: null as unknown as any } },
      orderBy: { index: 'asc' },
      take: limit,
    });
    return chunks.map(mapLessonChunkToDomain);
  }
}
