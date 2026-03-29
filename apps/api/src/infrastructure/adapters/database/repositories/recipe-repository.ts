import { prisma } from '../client';

import type { Recipe, RecipeStep } from '@/domain/entities/recipe';
import type { RecipeRepository, RecipeStepWithContent } from '@/domain/ports/recipe-repository';
import type { Concept } from '@/domain/entities/concept.js';
import type { Activity } from '@/domain/entities/activity.js';

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
        condition: step.condition as any,
        onCondition: step.onCondition,
        stepType: step.stepType,
        script: step.script as any,
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
        condition: step.condition as any,
        onCondition: step.onCondition,
        script: step.script as any,
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

  private mapRecipe(raw: any): Recipe {
    return {
      id: raw.id,
      canonicalId: raw.canonicalId,
      title: raw.title,
      description: raw.description,
      expectedDurationMinutes: raw.expectedDurationMinutes,
      version: raw.version,
      published: raw.published,
      moduleId: raw.moduleId,
      steps: [], // will be loaded separately if needed
      tags: [],
      attachments: [],
      progressEntries: [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private mapRecipeStep(raw: any): RecipeStep {
    return {
      id: raw.id,
      recipeId: raw.recipeId,
      atomId: raw.atomId,
      order: raw.order,
      condition: raw.condition,
      onCondition: raw.onCondition,
      createdAt: raw.createdAt,
      // New fields
      conceptId: raw.conceptId || undefined,
      activityId: raw.activityId || undefined,
      script: raw.script || undefined,
      stepType: raw.stepType || undefined,
    };
  }
}
