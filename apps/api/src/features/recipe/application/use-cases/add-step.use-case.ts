import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import { RecipeNotFoundError, RecipeOwnershipError } from '@/shared/errors/domain-errors.js';
import type { RecipeStep, StepType } from '../../domain/entities/recipe.entity.js';
import { CanonicalId } from '../../domain/valueObjects/canonical-id.vo.js';
import { AtomType } from '@/features/knowledge/domain/entities/atom.entity.js';

export interface AddStepInput {
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

export class AddStepUseCase {
  constructor(
    private recipeRepository: RecipeRepository,
    private atomRepository: AtomRepository,
  ) {}

  async execute(recipeId: string, stepData: AddStepInput, userId: string): Promise<RecipeStep> {
    console.log('[AddStepUseCase] Step 1: Starting execute for recipe:', recipeId);
    const recipe = await this.recipeRepository.findById(recipeId);
    console.log('[AddStepUseCase] Step 2: Recipe found:', recipe ? 'yes' : 'no');
    if (!recipe) {
      throw new RecipeNotFoundError(recipeId);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(recipeId, userId);
    }

    console.log('[AddStepUseCase] Step 3: Checking existing steps');
    const existingSteps = await this.recipeRepository.findStepsByRecipeId(recipeId);
    const maxOrder = existingSteps.length > 0 ? Math.max(...existingSteps.map((s) => s.order)) : -1;
    console.log('[AddStepUseCase] Step 4: maxOrder:', maxOrder);

    console.log(
      '[AddStepUseCase] Step 5: Creating atom for stepType:',
      stepData.stepType || 'content',
    );
    const atomId = await this.ensureAtomForStep(
      stepData.stepType || 'content',
      stepData.script,
      stepData.activity,
      stepData.question,
    );
    console.log('[AddStepUseCase] Step 6: Atom created with id:', atomId);

    console.log(
      '[AddStepUseCase] Step 7: Creating step with atomId:',
      atomId,
      'order:',
      stepData.order ?? maxOrder + 1,
    );
    const step = await this.recipeRepository.createStep({
      id: crypto.randomUUID(),
      recipeId,
      atomId,
      order: stepData.order ?? maxOrder + 1,
      condition: stepData.condition,
      onCondition: stepData.onCondition,
      conceptId: stepData.conceptId || undefined,
      activityId: stepData.activityId || undefined,
      script: stepData.script,
      activityData: stepData.activity,
      question: stepData.question,
      stepType: stepData.stepType || 'content',
    });
    console.log('[AddStepUseCase] Step 8: Step created successfully:', step.id);

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
        if (script?.content) {
          const contentObj = script.content as { text?: string };
          atomTitle = contentObj?.text?.substring(0, 80) || atomTitle;
        }
        break;
      case 'activity':
        content = activity;
        if (activity?.instruction) {
          const instructionObj = activity.instruction as { text?: string };
          atomTitle = instructionObj?.text?.substring(0, 80) || atomTitle;
        }
        break;
      case 'question':
        content = question;
        if (question?.question) {
          const questionObj = question.question as { text?: string };
          atomTitle = questionObj?.text?.substring(0, 80) || atomTitle;
        }
        break;
    }

    // Ensure canonicalId is <= 100 chars (DB limit)
    const sanitized = CanonicalId.sanitize(atomTitle).substring(0, 80);
    const canonicalId = sanitized + '-' + crypto.randomUUID().slice(0, 8);

    // Build complete content object for the atom
    const atomContent = content ? { type: stepType, ...content } : { type: stepType };

    try {
      const newAtom = await this.atomRepository.create({
        id: crypto.randomUUID(),
        canonicalId: canonicalId,
        title: atomTitle.substring(0, 255),
        description: `Auto-generated atom for ${stepType} step.`,
        type: AtomType.MICROLECTURE,
        ssmlChunks: undefined,
        content: atomContent,
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: false,
        durationSeconds: 0,
      });

      return newAtom.id;
    } catch (err) {
      console.error('[AddStepUseCase] Error creating atom:', err);
      throw err;
    }
  }
}
