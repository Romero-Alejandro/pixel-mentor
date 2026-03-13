import type { Module } from './module';

export interface Level {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly minAge?: number;
  readonly maxAge?: number;
  readonly modules: readonly Module[];
  readonly createdAt: Date;
}

export function createLevel(parameters: {
  id: string;
  slug: string;
  name: string;
  minAge?: number;
  maxAge?: number;
  modules?: Module[];
}): Level {
  return {
    id: parameters.id,
    slug: parameters.slug,
    name: parameters.name,
    minAge: parameters.minAge,
    maxAge: parameters.maxAge,
    modules: Object.freeze([...(parameters.modules ?? [])]),
    createdAt: new Date(),
  };
}
