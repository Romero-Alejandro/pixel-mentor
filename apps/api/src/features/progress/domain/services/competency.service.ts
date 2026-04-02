import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import type { AtomCompetency } from '@/features/knowledge/domain/entities/atom-competency.entity.js';

export class CompetencyService {
  constructor(private atomRepo: AtomRepository) {}

  async getCompetenciesForAtom(atomId: string): Promise<AtomCompetency[]> {
    return this.atomRepo.findCompetenciesByAtomId(atomId);
  }

  async linkCompetency(atomId: string, competencyId: string, weight?: number): Promise<void> {
    await this.atomRepo.linkCompetency(atomId, competencyId, weight);
  }
}
