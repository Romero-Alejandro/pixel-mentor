import type { AtomRepository } from '../ports/atom-repository.js';
import type { AtomCompetency } from '../entities/atom-competency.js';

export class CompetencyService {
  constructor(private atomRepo: AtomRepository) {}

  async getCompetenciesForAtom(atomId: string): Promise<AtomCompetency[]> {
    return this.atomRepo.findCompetenciesByAtomId(atomId);
  }

  async linkCompetency(atomId: string, competencyId: string, weight?: number): Promise<void> {
    await this.atomRepo.linkCompetency(atomId, competencyId, weight);
  }
}
