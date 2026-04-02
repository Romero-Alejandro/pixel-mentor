import { prisma } from '@/database/client';

import type { Recipe, RecipeStep } from '@/features/recipe/domain/entities/recipe.entity';
import type { RecipeRepository, RecipeStepWithContent } from '@/features/recipe/domain/ports/recipe.repository.port';
import type { Concept } from '@/features/knowledge/domain/entities/concept.entity';
import type { Activity } from '@/features/activity/domain/entities/activity.entity';

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
    return {
      ...this.mapRecipe(raw),
      steps: raw.steps.map(this.mapRecipeStep),
    };
  }

  async findAll(): Promise<Recipe[]> {
    const raw = await prisma.recipe.findMany();
    return raw.map(this.mapRecipe);
  }

  async findPublished(): Promise<Recipe[]> {
    const raw = await prisma.recipe.findMany({ where: { published: true } });
    return raw.map(this.mapRecipe);
  }

  async create(recipe: Omit<Recipe, 'createdAt' | 'updatedAt' | 'steps'>): Promise<Recipe> {
    const raw = await prisma.recipe.create({
      data: {
        canonicalId: recipe.canonicalId,
        title: recipe.title,
        description: recipe.description,
        expectedDurationMinutes: recipe.expectedDurationMinutes,
        version: recipe.version,
        published: recipe.published,
        moduleId: recipe.moduleId,
      },
    });
    return this.mapRecipe(raw);
  }

  async update(id: string, data: Partial<Recipe>): Promise<Recipe> {
    const raw = await prisma.recipe.update({
      where: { id },
      data: {
        canonicalId: data.canonicalId,
        title: data.title,
        description: data.description,
        expectedDurationMinutes: data.expectedDurationMinutes,
        version: data.version,
        published: data.published,
        moduleId: data.moduleId,
      },
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
        condition: step.condition as never,
        onCondition: step.onCondition,
        stepType: step.stepType,
        script: step.script as never,
        conceptId: step.conceptId,
        activityId: step.activityId,
      },
    });
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
        stepType: step.stepType,
        conceptId: step.conceptId,
        activityId: step.activityId,
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
    return {
      id: raw.id as string,
      canonicalId: raw.canonicalId as string,
      title: raw.title as string,
      description: raw.description as string | undefined,
      expectedDurationMinutes: raw.expectedDurationMinutes as number | undefined,
      version: raw.version as string,
      published: raw.published as boolean,
      moduleId: raw.moduleId as string | undefined,
      steps: [],
      tags: [],
      attachments: [],
      progressEntries: [],
      createdAt: raw.createdAt as Date,
      updatedAt: raw.updatedAt as Date,
    };
  }

  private mapRecipeStep(raw: Record<string, unknown>): RecipeStep {
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
      stepType: raw.stepType as 'content' | 'activity' | 'question' | 'intro' | 'closure' | undefined,
    };
  }
}
