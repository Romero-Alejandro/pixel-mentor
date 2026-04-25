import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  StepNotFoundError,
} from '@/shared/errors/domain-errors.js';
import type { RecipeStep, StepType } from '../../domain/entities/recipe.entity.js';
import { CanonicalId } from '../../domain/valueObjects/canonical-id.vo.js';
import { AtomType } from '@/features/knowledge/domain/entities/atom.entity.js';

export interface UpdateStepInput {
  atomId?: string;
  order?: number;
  conceptId?: string;
  activityId?: string;
  stepType?: StepType;
  script?: Record<string, unknown> | null;
  activity?: Record<string, unknown> | null;
  question?: Record<string, unknown> | null;
  condition?: unknown;
  onCondition?: string;
}

export class UpdateStepUseCase {
  constructor(
    private recipeRepository: RecipeRepository,
    private atomRepository: AtomRepository,
  ) {}

  async execute(stepId: string, stepData: UpdateStepInput, userId: string): Promise<RecipeStep> {
    const existingStep = await this.recipeRepository.findStepById(stepId);
    if (!existingStep) {
      throw new StepNotFoundError(stepId);
    }

    const recipeId = existingStep.recipeId;
    const recipe = await this.recipeRepository.findById(recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(recipeId);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(recipeId, userId);
    }

    const effectiveStepType = stepData.stepType || existingStep.stepType || 'content';

    let newScriptContent: Record<string, unknown> | undefined;
    if (stepData.script !== undefined) {
      newScriptContent = stepData.script || undefined;
    } else if (stepData.activity !== undefined) {
      newScriptContent = stepData.activity || undefined;
    } else if (stepData.question !== undefined) {
      newScriptContent = stepData.question || undefined;
    } else {
      newScriptContent = existingStep.script;
    }

    const effectiveAtomId = await this.ensureAtomForStep(
      effectiveStepType,
      newScriptContent &&
        (effectiveStepType === 'content' ||
          effectiveStepType === 'intro' ||
          effectiveStepType === 'closure')
        ? newScriptContent
        : undefined,
      newScriptContent && effectiveStepType === 'activity' ? newScriptContent : undefined,
      newScriptContent && effectiveStepType === 'question' ? newScriptContent : undefined,
      existingStep.atomId,
    );

    const updateData: Record<string, unknown> = {
      atomId: effectiveAtomId,
      stepType: effectiveStepType,
    };

    if (stepData.order !== undefined) {
      updateData.order = stepData.order;
    }
    if (stepData.condition !== undefined) {
      updateData.condition = stepData.condition;
    }
    if (stepData.onCondition !== undefined) {
      updateData.onCondition = stepData.onCondition;
    }
    if (stepData.conceptId !== undefined) {
      updateData.conceptId = stepData.conceptId;
    }
    if (stepData.activityId !== undefined) {
      updateData.activityId = stepData.activityId;
    }
    if (newScriptContent !== undefined) {
      updateData.script = newScriptContent;
    }
    if (stepData.activity !== undefined) {
      updateData.activityData = stepData.activity;
    }
    if (stepData.question !== undefined) {
      updateData.question = stepData.question;
    }

    const updated = await this.recipeRepository.updateStep(stepId, updateData as any);
    return updated;
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
