import { prisma } from '@/database/client';
import { toPrismaJsonOrUndefined } from '@/shared/utils/prisma-json.js';
import { StepType as PrismaStepType } from '@/database/generated/client/index.js';
import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity';
import type {
  RecipeRepository,
  RecipeStepWithContent,
  RecipeCreateInput,
  RecipeUpdateInput,
  RecipeStepUpdateInput,
} from '@/features/recipe/domain/ports/recipe.repository.port';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';
import type { Activity } from '@/features/activity/domain/entities/activity.entity';
import { CanonicalId } from '@/features/recipe/domain/value-objects/canonical-id.vo.js';
import { SemanticVersion } from '@/features/recipe/domain/value-objects/semantic-version.vo.js';
import { ExpectedDuration } from '@/features/recipe/domain/value-objects/expected-duration.vo.js';
import { StepNotFoundError } from '@/shared/errors/domain-errors.js';

export class PrismaRecipeRepository implements RecipeRepository {
  async findById(id: string): Promise<Recipe | null> {
    const raw = await prisma.recipe.findUnique({ where: { id } });
    if (!raw) return null;
    return this.mapRecipe(raw);
  }

  async findByIdWithSteps(id: string): Promise<Recipe | null> {
    const raw = await prisma.recipe.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!raw) return null;
    const base = this.mapRecipe(raw);
    return Object.freeze({
      ...base,
      steps: Object.freeze(raw.steps.map(this.mapRecipeStep)),
    });
  }

  async findAll(): Promise<Recipe[]> {
    const raw = await prisma.recipe.findMany();
    return raw.map(this.mapRecipe);
  }

  async findPublished(): Promise<Recipe[]> {
    const raw = await prisma.recipe.findMany({ where: { published: true } });
    return raw.map(this.mapRecipe);
  }

  async findByUserId(userId: string): Promise<Recipe[]> {
    const raw = await prisma.recipe.findMany({ where: { authorId: userId } });
    return raw.map(this.mapRecipe);
  }

  async findByUserIdAndPublished(userId: string, published: boolean): Promise<Recipe[]> {
    const raw = await prisma.recipe.findMany({
      where: { authorId: userId, published },
    });
    return raw.map(this.mapRecipe);
  }

  async create(recipe: RecipeCreateInput): Promise<Recipe> {
    const raw = await prisma.recipe.create({
      data: {
        canonicalId: recipe.canonicalId,
        title: recipe.title,
        description: recipe.description,
        expectedDurationMinutes: recipe.expectedDurationMinutes,
        version: recipe.version,
        published: recipe.published,
        moduleId: recipe.moduleId,
        authorId: recipe.authorId,
      },
    });
    return this.mapRecipe(raw);
  }

  async update(id: string, data: RecipeUpdateInput): Promise<Recipe> {
    const updateData: Record<string, unknown> = {};

    if (data.canonicalId !== undefined) {
      updateData.canonicalId = data.canonicalId;
    }
    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.expectedDurationMinutes !== undefined) {
      updateData.expectedDurationMinutes = data.expectedDurationMinutes;
    }
    if (data.version !== undefined) {
      updateData.version = data.version;
    }
    if (data.published !== undefined) {
      updateData.published = data.published;
    }
    if (data.moduleId !== undefined) {
      updateData.moduleId = data.moduleId;
    }

    const raw = await prisma.recipe.update({
      where: { id },
      data: updateData,
    });
    return this.mapRecipe(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.recipe.delete({ where: { id } });
  }

  async findStepsByRecipeId(recipeId: string): Promise<RecipeStep[]> {
    const steps = await prisma.recipeStep.findMany({
      where: { recipeId },
      orderBy: { order: 'asc' },
    });
    return steps.map(this.mapRecipeStep);
  }

  async findStepsWithContent(recipeId: string): Promise<RecipeStepWithContent[]> {
    const steps = await prisma.recipeStep.findMany({
      where: { recipeId },
      orderBy: { order: 'asc' },
      include: {
        concept: true,
        activity: true,
      },
    });
    return steps.map((step): RecipeStepWithContent => {
      const base = this.mapRecipeStep(step);
      return {
        ...base,
        concept: step.concept ? (step.concept as unknown as Concept) : null,
        activity: step.activity ? (step.activity as unknown as Activity) : null,
      };
    });
  }

  async createStep(step: Omit<RecipeStep, 'createdAt'>): Promise<RecipeStep> {
    const raw = await prisma.recipeStep.create({
      data: {
        recipeId: step.recipeId,
        atomId: step.atomId,
        order: step.order,
        condition: toPrismaJsonOrUndefined(step.condition, 'step.condition'),
        onCondition: step.onCondition,
        stepType: this.normalizeStepTypeForPrisma(step.stepType),
        script: toPrismaJsonOrUndefined(step.script, 'step.script'),
        activityData: toPrismaJsonOrUndefined(step.activityData, 'step.activityData'),
        question: toPrismaJsonOrUndefined(step.question, 'step.question'),
        conceptId: step.conceptId,
        activityId: step.activityId,
      },
    });
    return this.mapRecipeStep(raw);
  }

  async updateStep(stepId: string, step: RecipeStepUpdateInput): Promise<RecipeStep> {
    const raw = await prisma.recipeStep.update({
      where: { id: stepId },
      data: {
        atomId: step.atomId,
        order: step.order,
        condition: toPrismaJsonOrUndefined(step.condition, 'step.condition'),
        onCondition: step.onCondition,
        script: toPrismaJsonOrUndefined(step.script, 'step.script'),
        stepType: this.normalizeStepTypeForPrisma(step.stepType),
        conceptId: step.conceptId,
        activityId: step.activityId,
        activityData: toPrismaJsonOrUndefined(step.activityData, 'step.activityData'),
        question: toPrismaJsonOrUndefined(step.question, 'step.question'),
      },
    });
    return this.mapRecipeStep(raw);
  }

  async deleteStep(stepId: string): Promise<void> {
    await prisma.recipeStep.delete({ where: { id: stepId } });
  }

  async findStepById(stepId: string): Promise<RecipeStep | null> {
    const raw = await prisma.recipeStep.findUnique({ where: { id: stepId } });
    if (!raw) return null;
    return this.mapRecipeStep(raw);
  }

  /**
   * Single interactive transaction implementing a constraint-safe reorder:
   * a two-phase order swap (current + TEMP_OFFSET → final) avoids the
   * @@unique([recipeId, order]) conflicts while keeping the whole operation
   * atomic — a failure rolls back completely instead of leaving half-shifted
   * orders. Validating membership inside the tx makes the check-then-write
   * race-free against concurrent step additions/removals for this recipe.
   *
   * `stepIds` anchors the leading positions (0-based); unlisted steps keep
   * their previous relative order after them.
   */
  async reorderSteps(recipeId: string, stepIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Read current orders inside the tx (also validates membership).
      const orderedIds = [...new Set(stepIds)];
      const steps = await tx.recipeStep.findMany({
        where: { recipeId, id: { in: orderedIds } },
        select: { id: true, order: true },
      });
      if (steps.length !== orderedIds.length) {
        const foundIds = new Set(steps.map((s) => s.id));
        const missing = orderedIds.find((id) => !foundIds.has(id));
        throw new StepNotFoundError(missing ?? '<unknown>');
      }

      // 2. Pass 1 — lift listed steps above unlisted ones (offset swap).
      //    Ordering the temp values by the desired index is what lets pass 2
      //    skip conflict resolution for unlisted steps.
      const UNLISTED_TEMP_OFFSET = 10000;
      const listedMaxOrder = Math.max(...steps.map((s) => s.order), -1);
      const tempBase = listedMaxOrder + 1 + UNLISTED_TEMP_OFFSET;
      for (const [index, stepId] of orderedIds.entries()) {
        await tx.recipeStep.update({
          where: { id: stepId },
          data: { order: tempBase + index },
        });
      }

      // 3. Pass 2 — unlisted steps take their final 0..n orders (safe: listed
      //    steps now sit above the final range, so @@unique never conflicts).
      const unlisted = await tx.recipeStep.findMany({
        where: { recipeId, id: { notIn: orderedIds } },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
      });
      let cursor = orderedIds.length;
      for (const step of unlisted) {
        await tx.recipeStep.update({
          where: { id: step.id },
          data: { order: cursor++ },
        });
      }

      // 4. Pass 3 — listed steps drop into their final positions.
      for (const [index, stepId] of orderedIds.entries())
        await tx.recipeStep.update({
          where: { id: stepId },
          data: { order: index },
        });
    });
  }

  private mapRecipe(raw: Record<string, unknown>): Recipe {
    return Object.freeze({
      id: raw.id as string,
      canonicalId: CanonicalId.create(raw.canonicalId as string),
      title: raw.title as string,
      description: raw.description as string | undefined,
      expectedDurationMinutes: raw.expectedDurationMinutes
        ? ExpectedDuration.create(raw.expectedDurationMinutes as number)
        : undefined,
      version: SemanticVersion.parse(raw.version as string),
      published: raw.published as boolean,
      moduleId: raw.moduleId as string | undefined,
      authorId: raw.authorId as string,
      steps: Object.freeze([]),
      concepts: Object.freeze([]),
      tags: Object.freeze([]),
      attachments: Object.freeze([]),
      progressEntries: Object.freeze([]),
      meta: undefined,
      createdAt: raw.createdAt as Date,
      updatedAt: raw.updatedAt as Date,
    });
  }

  private mapRecipeStep(raw: Record<string, unknown>): RecipeStep {
    // Normalize stepType: Prisma returns enum, we normalize to lowercase string
    const rawStepType = raw.stepType as string | undefined;
    let stepType: RecipeStep['stepType'];

    if (!rawStepType) {
      stepType = undefined;
    } else if (
      rawStepType === 'content' ||
      rawStepType === 'activity' ||
      rawStepType === 'question' ||
      rawStepType === 'intro' ||
      rawStepType === 'closure' ||
      rawStepType === 'exam'
    ) {
      // Already a string (shouldn't happen but be safe)
      stepType = rawStepType as RecipeStep['stepType'];
    } else {
      // Prisma enum (QUESTION, ACTIVITY, etc.) - convert to lowercase string
      stepType = rawStepType.toLowerCase() as RecipeStep['stepType'];
    }

    return {
      id: raw.id as string,
      recipeId: raw.recipeId as string,
      atomId: raw.atomId as string,
      order: raw.order as number,
      condition: raw.condition,
      onCondition: raw.onCondition as string | undefined,
      createdAt: raw.createdAt as Date,
      conceptId: raw.conceptId as string | undefined,
      activityId: raw.activityId as string | undefined,
      script: raw.script as Record<string, unknown> | undefined,
      stepType,
    };
  }

  // Helper: normalize stepType for writes TO Prisma (needs enum)
  private normalizeStepTypeForPrisma(stepType: string | undefined): PrismaStepType | undefined {
    if (!stepType) return undefined;
    const upper = stepType.toUpperCase() as keyof typeof PrismaStepType;
    if (upper in PrismaStepType) {
      return PrismaStepType[upper];
    }
    // Fallback: try to match known types
    switch (stepType.toLowerCase()) {
      case 'content':
        return PrismaStepType.CONTENT;
      case 'activity':
        return PrismaStepType.ACTIVITY;
      case 'question':
        return PrismaStepType.QUESTION;
      case 'intro':
        return PrismaStepType.INTRO;
      case 'closure':
        return PrismaStepType.CLOSURE;
      case 'exam':
        return PrismaStepType.EXAM;
      default:
        return undefined;
    }
  }
}
