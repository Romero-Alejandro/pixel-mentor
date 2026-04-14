import { CanonicalId } from '../valueObjects/canonical-id.vo.js';
import { SemanticVersion } from '../valueObjects/semantic-version.vo.js';
import { ExpectedDuration } from '../valueObjects/expected-duration.vo.js';

import type { Tag } from './tag.entity.js';

import type { AssetAttachment } from '@/shared/entities/asset-attachment';
import type { UserProgress } from '@/features/progress/domain/entities/user-progress.entity';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';

export type RecipeStatus = 'draft' | 'published' | 'archived';

export type StepType = 'content' | 'activity' | 'question' | 'intro' | 'closure';

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

export interface RecipeStep {
  readonly id: string;
  readonly recipeId: string;
  readonly atomId: string;
  readonly order: number;
  readonly condition?: unknown;
  readonly onCondition?: string;
  readonly createdAt: Date;
  readonly conceptId?: string;
  readonly activityId?: string;
  readonly script?: StepScript;
  readonly activityData?: StepScript;
  readonly question?: StepScript;
  readonly stepType?: StepType;
}

export interface Recipe {
  readonly id: string;
  readonly canonicalId: CanonicalId;
  readonly title: string;
  readonly description?: string;
  readonly expectedDurationMinutes?: ExpectedDuration;
  readonly version: SemanticVersion;
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
  const version = parameters.version ?? '1.0.0';
  const expectedDuration = parameters.expectedDurationMinutes
    ? ExpectedDuration.create(parameters.expectedDurationMinutes)
    : undefined;

  return Object.freeze({
    id: parameters.id,
    canonicalId: CanonicalId.create(parameters.canonicalId),
    title: parameters.title,
    description: parameters.description,
    expectedDurationMinutes: expectedDuration,
    version: SemanticVersion.parse(version),
    published: parameters.published ?? false,
    moduleId: parameters.moduleId,
    authorId: parameters.authorId,
    steps: Object.freeze([...(parameters.steps ?? [])]),
    concepts: Object.freeze([]),
    tags: Object.freeze([]),
    attachments: Object.freeze([]),
    progressEntries: Object.freeze([]),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function createRecipeEntity(params: {
  id: string;
  canonicalId: CanonicalId;
  title: string;
  description?: string;
  expectedDurationMinutes?: ExpectedDuration;
  version: SemanticVersion;
  published: boolean;
  moduleId?: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  steps: readonly RecipeStep[];
}): Recipe {
  return Object.freeze({
    ...params,
    concepts: Object.freeze([]),
    tags: Object.freeze([]),
    attachments: Object.freeze([]),
    progressEntries: Object.freeze([]),
    meta: undefined,
  });
}
