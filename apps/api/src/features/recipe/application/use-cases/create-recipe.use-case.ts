import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import { RecipeValidationError } from '@/shared/errors/domain-errors.js';
import { CanonicalId } from '../../domain/valueObjects/canonical-id.vo.js';
import { SemanticVersion } from '../../domain/valueObjects/semantic-version.vo.js';
import { ExpectedDuration } from '../../domain/valueObjects/expected-duration.vo.js';
import type { Recipe, RecipeStep, StepType } from '../../domain/entities/recipe.entity.js';
import { AtomType } from '@/features/knowledge/domain/entities/atom.entity.js';

export interface CreateRecipeInput {
  title: string;
  description?: string;
  expectedDurationMinutes?: number;
  moduleId?: string;
  published?: boolean;
  steps?: CreateRecipeStepInput[];
}

export interface CreateRecipeStepInput {
  atomId?: string;
  order?: number;
  conceptId?: string;
  activityId?: string;
  stepType?: StepType;
  script?: Record<string, unknown>;
  activity?: Record<string, unknown>;
  question?: Record<string, unknown>;
  condition?: unknown;
  onCondition?: string;
}

export class CreateRecipeUseCase {
  constructor(
    private recipeRepository: RecipeRepository,
    private atomRepository: AtomRepository,
  ) {}

  async execute(data: CreateRecipeInput, userId: string): Promise<Recipe> {
    if (!data.title || data.title.trim().length === 0) {
      throw new RecipeValidationError('Recipe title is required');
    }

    const canonicalId = CanonicalId.fromTitle(data.title).toString();
    const version = SemanticVersion.initial().toString();
    const expectedDuration = data.expectedDurationMinutes
      ? ExpectedDuration.create(data.expectedDurationMinutes).minutes
      : undefined;

    const recipe = await this.recipeRepository.create({
      id: crypto.randomUUID(),
      canonicalId,
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      expectedDurationMinutes: expectedDuration,
      version,
      published: data.published || false,
      moduleId: data.moduleId || undefined,
      authorId: userId,
    });

    if (data.steps && data.steps.length > 0) {
      for (let i = 0; i < data.steps.length; i++) {
        const stepInput = data.steps[i];
        await this.addStep(recipe.id, { ...stepInput, order: stepInput.order ?? i }, userId);
      }
    }

    return this.recipeRepository.findByIdWithSteps(recipe.id) as Promise<Recipe>;
  }

  private async addStep(
    recipeId: string,
    stepData: CreateRecipeStepInput,
    _userId: string,
  ): Promise<RecipeStep> {
    const existingSteps = await this.recipeRepository.findStepsByRecipeId(recipeId);
    const maxOrder = existingSteps.length > 0 ? Math.max(...existingSteps.map((s) => s.order)) : -1;

    const atomId = await this.ensureAtomForStep(
      stepData.stepType || 'content',
      stepData.script,
      stepData.activity,
      stepData.question,
    );

    const step = await this.recipeRepository.createStep({
      id: crypto.randomUUID(),
      recipeId,
      atomId,
      order: stepData.order ?? maxOrder + 1,
      condition: undefined,
      onCondition: undefined,
      conceptId: stepData.conceptId || undefined,
      activityId: stepData.activityId || undefined,
      script: stepData.script,
      stepType: stepData.stepType || 'content',
    });

    return step;
  }

  private async ensureAtomForStep(
    stepType: StepType,
    script?: Record<string, unknown>,
    activity?: Record<string, unknown>,
    question?: Record<string, unknown>,
    currentAtomId?: string,
  ): Promise<string> {
    if (currentAtomId) {
      await this.atomRepository.update(currentAtomId, {
        content: { type: stepType, script, activity, question },
      });
      return currentAtomId;
    } else {
      return this.createAtomForStep(stepType, script, activity, question);
    }
  }

  private async createAtomForStep(
    stepType: StepType,
    script?: Record<string, unknown>,
    activity?: Record<string, unknown>,
    question?: Record<string, unknown>,
  ): Promise<string> {
    let content: Record<string, unknown> | undefined;
    let atomTitle = `Atom ${stepType}`;

    switch (stepType) {
      case 'content':
      case 'intro':
      case 'closure':
        content = script;
        if (script?.content) atomTitle = (script.content as { text?: string }).text || atomTitle;
        break;
      case 'activity':
        content = activity;
        if (activity?.instruction)
          atomTitle = (activity.instruction as { text?: string }).text || atomTitle;
        break;
      case 'question':
        content = question;
        if (question?.question)
          atomTitle = (question.question as { text?: string }).text || atomTitle;
        break;
    }

    const newAtom = await this.atomRepository.create({
      id: crypto.randomUUID(),
      canonicalId: CanonicalId.sanitize(atomTitle) + '-' + crypto.randomUUID().slice(0, 8),
      title: atomTitle.substring(0, 255),
      description: `Auto-generated atom for ${stepType} step.`,
      type: AtomType.MICROLECTURE,
      ssmlChunks: undefined,
      content: content ? { ...content, type: stepType } : undefined,
      locale: 'es-AR',
      difficulty: 1,
      version: '1.0.0',
      published: false,
      durationSeconds: 0,
    });

    return newAtom.id;
  }
}
