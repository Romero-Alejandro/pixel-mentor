export interface Tag {
  readonly id: string;
  readonly name: string;
}

export function createTag(parameters: { id: string; name: string }): Tag {
  return { id: parameters.id, name: parameters.name };
}
