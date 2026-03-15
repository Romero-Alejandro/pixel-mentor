import { prisma } from '../client';
import type { Concept } from '@/domain/entities/concept';
import type { ConceptRepository } from '@/domain/ports/concept-repository';

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
        introduction: concept.introduction as any,
        explanation: concept.explanation as any,
        examples: concept.examples as any,
        keyPoints: concept.keyPoints as any,
        closure: concept.closure as any,
      },
    });
    return this.mapConcept(raw);
  }

  async update(id: string, data: Partial<Concept>): Promise<Concept> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.introduction !== undefined) updateData.introduction = data.introduction as any;
    if (data.explanation !== undefined) updateData.explanation = data.explanation as any;
    if (data.examples !== undefined) updateData.examples = data.examples as any;
    if (data.keyPoints !== undefined) updateData.keyPoints = data.keyPoints as any;
    if (data.closure !== undefined) updateData.closure = data.closure as any;

    const raw = await prisma.concept.update({
      where: { id },
      data: updateData,
    });
    return this.mapConcept(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.concept.delete({ where: { id } });
  }

  private mapConcept(raw: any): Concept {
    return {
      id: raw.id,
      recipeId: raw.recipeId,
      title: raw.title,
      order: raw.order,
      introduction: raw.introduction,
      explanation: raw.explanation,
      examples: raw.examples || [],
      keyPoints: raw.keyPoints || [],
      closure: raw.closure,
      createdAt: raw.createdAt,
    };
  }
}
