import type { AssetAttachment } from '@/shared/entities/asset-attachment';
import type { UserProgress } from '@/features/progress/domain/entities/user-progress.entity';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';
import type { Tag } from './tag.entity.js';

export type RecipeStatus = 'draft' | 'published' | 'archived';

export type StepType = 'content' | 'activity' | 'question' | 'intro' | 'closure';

// Script for a recipe step (static content)
export interface StepTransition {
  readonly text: string;
}

export interface StepContent {
  readonly text: string;
  readonly chunks: readonly ContentChunk[];
}

export interface StepExample {
  readonly text: string;
  readonly visual?: {
    readonly type: 'image' | 'animation' | 'equation';
    readonly src?: string;
  };
}

export interface StepComprehensionCheck {
  readonly question: string;
  readonly expectedAnswer: string;
  readonly feedback: {
    readonly correct: string;
    readonly incorrect: string;
  };
}

export interface StepClosure {
  readonly text: string;
}

export interface StepScript extends Record<string, unknown> {}

export interface ContentChunk {
  readonly text: string;
  readonly pauseAfter: number;
}

export interface Recipe {
  readonly id: string;
  readonly canonicalId: string;
  readonly title: string;
  readonly description?: string;
  readonly expectedDurationMinutes?: number;
  readonly version: string;
  readonly published: boolean;
  readonly moduleId?: string;
  readonly authorId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly steps: readonly RecipeStep[];
  readonly concepts?: readonly Concept[];
  readonly tags?: readonly Tag[];
  readonly attachments?: readonly AssetAttachment[];
  readonly progressEntries?: readonly UserProgress[];
  readonly meta?: Record<string, unknown>;
}

export interface RecipeStep {
  readonly id: string;
  readonly recipeId: string;
  readonly atomId: string;
  readonly order: number;
  readonly condition?: unknown;
  readonly onCondition?: string;
  readonly createdAt: Date;
  // New fields for static content
  readonly conceptId?: string;
  readonly activityId?: string;
  readonly script?: StepScript;
  readonly stepType?: StepType;
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
  authorId: string;
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
    authorId: parameters.authorId,
    steps: Object.freeze([...(parameters.steps ?? [])]),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
