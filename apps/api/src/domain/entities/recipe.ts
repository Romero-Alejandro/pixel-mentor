import type { AssetAttachment } from './asset-attachment';
import type { UserProgress } from './user-progress';

export type RecipeStatus = 'draft' | 'published' | 'archived';

export interface Recipe {
  readonly id: string;
  readonly canonicalId: string;
  readonly title: string;
  readonly description?: string;
  readonly expectedDurationMinutes?: number;
  readonly version: string;
  readonly published: boolean;
  readonly moduleId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly steps: readonly RecipeStep[];
  readonly tags?: readonly Tag[];
  readonly attachments?: readonly AssetAttachment[];
  readonly progressEntries?: readonly UserProgress[];
}

export interface RecipeStep {
  readonly id: string;
  readonly recipeId: string;
  readonly atomId: string;
  readonly order: number;
  readonly condition?: any;
  readonly onCondition?: string;
  readonly createdAt: Date;
}

export interface Tag {
  readonly id: string;
  readonly name: string;
}

export interface RecipeTag {
  readonly recipeId: string;
  readonly tagId: string;
}

export function createRecipe(parameters: {
  id: string;
  canonicalId: string;
  title: string;
  description?: string;
  expectedDurationMinutes?: number;
  version?: string;
  published?: boolean;
  moduleId?: string;
  steps?: RecipeStep[];
}): Recipe {
  return {
    id: parameters.id,
    canonicalId: parameters.canonicalId,
    title: parameters.title,
    description: parameters.description,
    expectedDurationMinutes: parameters.expectedDurationMinutes,
    version: parameters.version ?? '1.0.0',
    published: parameters.published ?? false,
    moduleId: parameters.moduleId,
    steps: Object.freeze([...(parameters.steps ?? [])]),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
