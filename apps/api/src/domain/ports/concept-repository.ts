import type { Concept } from '../entities/concept';

export interface ConceptRepository {
  findById(id: string): Promise<Concept | null>;
  findByRecipeId(recipeId: string): Promise<Concept[]>;
  create(concept: Omit<Concept, 'createdAt'>): Promise<Concept>;
  update(id: string, data: Partial<Concept>): Promise<Concept>;
  delete(id: string): Promise<void>;
  findByRecipeIdOrdered(recipeId: string): Promise<Concept[]>;
}
