export interface Competency {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: Date;
}

export function createCompetency(parameters: {
  id: string;
  code: string;
  name: string;
  description?: string;
}): Competency {
  return {
    id: parameters.id,
    code: parameters.code,
    name: parameters.name,
    description: parameters.description,
    createdAt: new Date(),
  };
}
