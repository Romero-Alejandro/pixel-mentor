import type { Competency } from '../entities/competency';

export interface CompetencyRepository {
  findById(id: string): Promise<Competency | null>;
  findByCode(code: string): Promise<Competency | null>;
  findAll(): Promise<Competency[]>;
  create(competency: Omit<Competency, 'createdAt'>): Promise<Competency>;
  update(id: string, data: Partial<Competency>): Promise<Competency>;
  delete(id: string): Promise<void>;
}
