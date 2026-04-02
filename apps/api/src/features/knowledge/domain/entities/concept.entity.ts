// Concept: A pedagogical concept within a recipe

export interface ConceptIntroduction {
  readonly text: string;
  readonly duration: number; // estimated seconds
}

export interface ContentChunk {
  readonly text: string;
  readonly pauseAfter: number; // seconds of pause after this chunk
}

export interface ConceptExplanation {
  readonly text: string;
  readonly chunks: readonly ContentChunk[];
}

export interface ExampleVisual {
  readonly type: 'image' | 'animation' | 'equation';
  readonly src?: string;
}

export interface ConceptExample {
  readonly text: string;
  readonly visual?: ExampleVisual;
}

export interface ConceptClosure {
  readonly text: string;
}

export interface Concept {
  readonly id: string;
  readonly recipeId: string;
  readonly title: string;
  readonly order: number;
  readonly introduction: ConceptIntroduction;
  readonly explanation: ConceptExplanation;
  readonly examples: readonly ConceptExample[];
  readonly keyPoints: readonly string[];
  readonly closure: ConceptClosure;
  readonly createdAt: Date;
}

export function createConcept(parameters: {
  id: string;
  recipeId: string;
  title: string;
  order: number;
  introduction: ConceptIntroduction;
  explanation: ConceptExplanation;
  examples?: readonly ConceptExample[];
  keyPoints?: readonly string[];
  closure: ConceptClosure;
}): Concept {
  return {
    id: parameters.id,
    recipeId: parameters.recipeId,
    title: parameters.title,
    order: parameters.order,
    introduction: parameters.introduction,
    explanation: parameters.explanation,
    examples: Object.freeze([...(parameters.examples ?? [])]),
    keyPoints: Object.freeze([...(parameters.keyPoints ?? [])]),
    closure: parameters.closure,
    createdAt: new Date(),
  };
}
