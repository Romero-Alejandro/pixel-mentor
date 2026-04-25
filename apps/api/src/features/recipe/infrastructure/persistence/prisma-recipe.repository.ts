import { prisma } from '@/database/client';
import { StepType as PrismaStepType } from '@/database/generated/client/index.js';
import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity';
import type {
  RecipeRepository,
  RecipeStepWithContent,
  RecipeCreateInput,
  RecipeUpdateInput,
} from '@/features/recipe/domain/ports/recipe.repository.port';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';
import type { Activity } from '@/features/activity/domain/entities/activity.entity';
import { CanonicalId } from '@/features/recipe/domain/valueObjects/canonical-id.vo.js';
import { SemanticVersion } from '@/features/recipe/domain/valueObjects/semantic-version.vo.js';
import { ExpectedDuration } from '@/features/recipe/domain/valueObjects/expected-duration.vo.js';

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
    console.log('[createStep] Input:', JSON.stringify(step, null, 2));
    const raw = await prisma.recipeStep.create({
      data: {
        recipeId: step.recipeId,
        atomId: step.atomId,
        order: step.order,
        condition: step.condition as never,
        onCondition: step.onCondition,
        stepType: this.normalizeStepTypeForPrisma(step.stepType),
        script: step.script as never,
        activityData: (step as any).activityData as never,
        question: (step as any).question as never,
        conceptId: step.conceptId,
        activityId: step.activityId,
      },
    });
    console.log('[createStep] Created:', JSON.stringify(raw, null, 2));
    return this.mapRecipeStep(raw);
  }

  async updateStep(stepId: string, step: Partial<RecipeStep>): Promise<RecipeStep> {
    const raw = await prisma.recipeStep.update({
      where: { id: stepId },
      data: {
        atomId: step.atomId,
        order: step.order,
        condition: step.condition as never,
        onCondition: step.onCondition,
        script: step.script as never,
        stepType: this.normalizeStepTypeForPrisma(step.stepType),
        conceptId: step.conceptId,
        activityId: step.activityId,
        activityData: (step as any).activityData as never,
        question: (step as any).question as never,
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
