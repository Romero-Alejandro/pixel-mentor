import type { Atom } from '../entities/atom';

export interface AtomRepository {
  findById(id: string): Promise<Atom | null>;
  findByCanonicalId(canonicalId: string): Promise<Atom | null>;
  findAll(published?: boolean): Promise<Atom[]>;
  create(
    atom: Omit<
      Atom,
      'createdAt' | 'updatedAt' | 'options' | 'competencies' | 'attachments' | 'knowledgeChunks'
    >,
  ): Promise<Atom>;
  update(id: string, data: Partial<Atom>): Promise<Atom>;
  delete(id: string): Promise<void>;
  findOptionsByAtomId(atomId: string): Promise<any[]>;
  createOption(option: any): Promise<any>;
  findCompetenciesByAtomId(atomId: string): Promise<any[]>;
  linkCompetency(atomId: string, competencyId: string, weight?: number): Promise<void>;
}

export class AtomNotFoundError extends Error {
  readonly code = 'ATOM_NOT_FOUND' as const;
  constructor(atomId: string) {
    super(`Atom with ID ${atomId} not found`);
    this.name = 'AtomNotFoundError';
  }
}
