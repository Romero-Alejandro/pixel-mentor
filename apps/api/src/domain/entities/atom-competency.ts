export interface AtomCompetency {
  readonly id: string;
  readonly atomId: string;
  readonly competencyId: string;
  readonly weight: number;
}

export function createAtomCompetency(parameters: {
  id: string;
  atomId: string;
  competencyId: string;
  weight?: number;
}): AtomCompetency {
  return {
    id: parameters.id,
    atomId: parameters.atomId,
    competencyId: parameters.competencyId,
    weight: parameters.weight ?? 1.0,
  };
}
