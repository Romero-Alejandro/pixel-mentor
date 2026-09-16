import { prisma } from '@/database/client.js';
import {
  toPrismaJsonRequired,
  toPrismaJsonRequiredOrUndefined,
} from '@/shared/utils/prisma-json.js';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity.js';
import type { ConceptRepository } from '@/features/knowledge/domain/ports/concept.repository.port.js';

/** Row shape returned by the generated Concept delegate. */
type ConceptRow =
  ReturnType<typeof prisma.concept.findUniqueOrThrow> extends Promise<infer R> ? R : never;

export class PrismaConceptRepository implements ConceptRepository {
  async findById(id: string): Promise<Concept | null> {
    const raw = await prisma.concept.findUnique({ where: { id } });
    if (!raw) return null;
    return this.mapConcept(raw);
  }

  async findByRecipeId(recipeId: string): Promise<Concept[]> {
    const raw = await prisma.concept.findMany({
      where: { recipeId },
      orderBy: { order: 'asc' },
    });
    return raw.map(this.mapConcept);
  }

  async findByRecipeIdOrdered(recipeId: string): Promise<Concept[]> {
    return this.findByRecipeId(recipeId);
  }

  async create(concept: Omit<Concept, 'createdAt'>): Promise<Concept> {
    const raw = await prisma.concept.create({
      data: {
        id: concept.id,
        recipeId: concept.recipeId,
        title: concept.title,
        order: concept.order,
        introduction: toPrismaJsonRequired(concept.introduction, 'concept.introduction'),
        explanation: toPrismaJsonRequired(concept.explanation, 'concept.explanation'),
        examples: toPrismaJsonRequired(concept.examples ?? [], 'concept.examples'),
        keyPoints: toPrismaJsonRequired(concept.keyPoints ?? [], 'concept.keyPoints'),
        closure: toPrismaJsonRequired(concept.closure, 'concept.closure'),
      },
    });
    return this.mapConcept(raw);
  }

  async update(id: string, data: Partial<Concept>): Promise<Concept> {
    const raw = await prisma.concept.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.order !== undefined && { order: data.order }),
        introduction: toPrismaJsonRequiredOrUndefined(data.introduction, 'concept.introduction'),
        explanation: toPrismaJsonRequiredOrUndefined(data.explanation, 'concept.explanation'),
        examples: toPrismaJsonRequiredOrUndefined(data.examples, 'concept.examples'),
        keyPoints: toPrismaJsonRequiredOrUndefined(data.keyPoints, 'concept.keyPoints'),
        closure: toPrismaJsonRequiredOrUndefined(data.closure, 'concept.closure'),
      },
    });
    return this.mapConcept(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.concept.delete({ where: { id } });
  }

  private mapConcept(raw: ConceptRow): Concept {
    return {
      id: raw.id,
      recipeId: raw.recipeId,
      title: raw.title,
      order: raw.order,
      introduction: raw.introduction as unknown as Concept['introduction'],
      explanation: raw.explanation as unknown as Concept['explanation'],
      examples: (raw.examples as unknown as Concept['examples']) ?? [],
      keyPoints: raw.keyPoints as Concept['keyPoints'],
      closure: raw.closure as unknown as Concept['closure'],
      createdAt: raw.createdAt,
    };
  }
}
