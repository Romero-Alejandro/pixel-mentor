import { prisma } from '@/database/client';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';
import type { ConceptRepository } from '@/features/knowledge/domain/ports/concept.repository.port';

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
        introduction: concept.introduction as never,
        explanation: concept.explanation as never,
        examples: concept.examples as never,
        keyPoints: concept.keyPoints as never,
        closure: concept.closure as never,
      },
    });
    return this.mapConcept(raw);
  }

  async update(id: string, data: Partial<Concept>): Promise<Concept> {
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.introduction !== undefined) updateData.introduction = data.introduction;
    if (data.explanation !== undefined) updateData.explanation = data.explanation;
    if (data.examples !== undefined) updateData.examples = data.examples;
    if (data.keyPoints !== undefined) updateData.keyPoints = data.keyPoints;
    if (data.closure !== undefined) updateData.closure = data.closure;

    const raw = await prisma.concept.update({
      where: { id },
      data: updateData as never,
    });
    return this.mapConcept(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.concept.delete({ where: { id } });
  }

  private mapConcept(raw: Record<string, unknown>): Concept {
    return {
      id: raw.id as string,
      recipeId: raw.recipeId as string,
      title: raw.title as string,
      order: raw.order as number,
      introduction: raw.introduction as Concept['introduction'],
      explanation: raw.explanation as Concept['explanation'],
      examples: (raw.examples as Array<{ text: string }>) || [],
      keyPoints: (raw.keyPoints as string[]) || [],
      closure: raw.closure as Concept['closure'],
      createdAt: raw.createdAt as Date,
    };
  }
}
