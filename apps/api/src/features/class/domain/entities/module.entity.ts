// Module entity - simplified without Recipe dependency

export interface Module {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly levelId: string;
  readonly recipes: readonly string[]; // Store recipe IDs instead of full objects
  readonly createdAt: Date;
}

export function createModule(parameters: {
  id: string;
  slug: string;
  name: string;
  levelId: string;
  recipes?: string[];
}): Module {
  return {
    id: parameters.id,
    slug: parameters.slug,
    name: parameters.name,
    levelId: parameters.levelId,
    recipes: Object.freeze([...(parameters.recipes ?? [])]),
    createdAt: new Date(),
  };
}
