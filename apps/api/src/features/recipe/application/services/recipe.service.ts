/**
 * Recipe Application Service
 *
 * Handles all recipe CRUD operations including step management.
 * Enforces business rules, authorization, and validation.
 */

import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import type { Recipe, RecipeStep, StepType } from '../../domain/entities/recipe.entity.js';
import { AtomType } from '@/features/knowledge/domain/entities/atom.entity.js';

// Import errors from centralized module
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeValidationError,
  StepNotFoundError,
} from '@/shared/errors/index.js';

// Re-export errors for backward compatibility
export {
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeInUseError,
  RecipeValidationError,
  StepNotFoundError,
} from '@/shared/errors/index.js';

// Content data interfaces for typed step content
export interface ScriptData extends Record<string, unknown> {}
export interface ActivityData extends Record<string, unknown> {}
export interface QuestionData extends Record<string, unknown> {}
export type RecipeCondition = unknown;

// ==================== DTOs ====================

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
  script?: ScriptData;
  activity?: ActivityData;
  question?: QuestionData;
  condition?: RecipeCondition;
  onCondition?: string;
}

export interface UpdateRecipeInput {
  title?: string;
  description?: string;
  expectedDurationMinutes?: number;
  moduleId?: string;
  published?: boolean;
}

export interface UpdateRecipeStepInput {
  atomId?: string;
  order?: number;
  conceptId?: string;
  activityId?: string;
  stepType?: StepType;
  script?: ScriptData | null;
  activity?: ActivityData | null;
  question?: QuestionData | null;
  condition?: RecipeCondition;
  onCondition?: string;
}

// ==================== Service ====================

export class RecipeService {
  constructor(
    private recipeRepository: RecipeRepository,
    private atomRepository: AtomRepository, // Inject AtomRepository
  ) {}

  /**
   * Generate a canonical ID (slug) from title
   */
  private generateCanonicalId(title: string): string {
    return (
      title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .slice(0, 80) + // Limit length
      '-' +
      crypto.randomUUID().slice(0, 8)
    );
  }

  /**
   * Increment semantic version (patch bump)
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return '1.0.1';
    }
    parts[2] += 1;
    return parts.join('.');
  }

  /**
   * Creates a new Atom for a given step based on its content.
   * This is used when a step is added or its content is updated via the recipe editor.
   * @param stepType The type of the step ('content', 'activity', 'question', 'intro', 'closure').
   * @param script The script content for 'content', 'intro', 'closure' step types.
   * @param activity The activity content for 'activity' step types.
   * @param question The question content for 'question' step types.
   * @returns The ID of the newly created Atom.
   */
  private async createAtomForStep(
    stepType: StepType,
    script?: ScriptData,
    activity?: ActivityData,
    question?: QuestionData,
  ): Promise<string> {
    // Determine content based on stepType
    let content: Record<string, unknown> | undefined;
    let atomTitle = `Atom ${stepType}`; // Default title

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

    // Create a generic Atom based on step content
    const newAtom = await this.atomRepository.create({
      id: crypto.randomUUID(), // Automatically generate ID for new Atom
      canonicalId: this.generateCanonicalId(atomTitle),
      title: atomTitle.substring(0, 255), // Truncate to fit schema
      description: `Auto-generated atom for ${stepType} step.`,
      type: AtomType.MICROLECTURE, // Generic type
      ssmlChunks: undefined,
      content: content ? { ...content, type: stepType } : undefined, // Store step content in atom.content
      locale: 'es-AR',
      difficulty: 1,
      version: '1.0.0',
      published: false, // Auto-generated atoms are not published by default
      durationSeconds: 0, // Not directly calculable here
    });

    return newAtom.id;
  }

  // TODO: Implement actual ownership check when Recipe entity includes createdBy/tutorId
  private async canManageRecipe(recipeId: string, _userId: string): Promise<boolean> {
    const recipe = await this.recipeRepository.findById(recipeId);
    if (!recipe) return false;
    // For now, allow any logged in user to modify until createdBy is added to Recipe entity
    // In future, check: return recipe.createdBy === userId || user.role === 'ADMIN';
    return true;
  }

  /**
   * Ensure Atom for a step exists, creating it if necessary.
   * @param stepType The type of the step ('content', 'activity', 'question', 'intro', 'closure').
   * @param script The script content for 'content', 'intro', 'closure' step types.
   * @param activity The activity content for 'activity' step types.
   * @param question The question content for 'question' step types.
   * @param currentAtomId Current atom ID if updating an existing step.
   * @returns The effective atom ID for the step.
   */
  private async ensureAtomForStep(
    stepType: StepType,
    script?: ScriptData,
    activity?: ActivityData,
    question?: QuestionData,
    currentAtomId?: string, // If updating an existing step
  ): Promise<string> {
    if (currentAtomId) {
      // If an atomId already exists, update the existing atom's content
      await this.atomRepository.update(currentAtomId, {
        content: { type: stepType, script, activity, question }, // Update atom content
      });
      return currentAtomId;
    } else {
      // If no atomId, create a new atom
      return this.createAtomForStep(stepType, script, activity, question);
    }
  }

  /**
   * Create a new recipe
   */
  async createRecipe(data: CreateRecipeInput, _userId: string): Promise<Recipe> {
    // Validate: title is required
    if (!data.title || data.title.trim().length === 0) {
      throw new RecipeValidationError('Recipe title is required');
    }

    // Generate canonicalId from title
    const canonicalId = this.generateCanonicalId(data.title);

    // Set version to 1.0.0 for new recipes
    const version = '1.0.0';

    // Create recipe (without steps)
    const recipe = await this.recipeRepository.create({
      id: crypto.randomUUID(),
      canonicalId,
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      expectedDurationMinutes: data.expectedDurationMinutes || undefined,
      version,
      published: data.published || false,
      moduleId: data.moduleId || undefined,
    });

    // Add steps if provided, using addStep to ensure Atom generation
    if (data.steps && data.steps.length > 0) {
      for (let i = 0; i < data.steps.length; i++) {
        const stepInput = data.steps[i];
        await this.addStep(recipe.id, { ...stepInput, order: stepInput.order ?? i }, _userId);
      }
    }

    // Return recipe with steps
    return this.getRecipeById(recipe.id);
  }

  /**
   * Get recipe by ID with all steps
   */
  async getRecipeById(id: string): Promise<Recipe> {
    const recipe = await this.recipeRepository.findByIdWithSteps(id);
    if (!recipe) {
      throw new RecipeNotFoundError(id);
    }
    return recipe;
  }

  /**
   * Update a recipe
   * Only owner can update unless admin
   */
  async updateRecipe(
    id: string,
    data: UpdateRecipeInput,
    _userId: string,
    _isAdmin: boolean = false,
  ): Promise<Recipe> {
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError(id);
    }

    // Increment version on any change
    const newVersion = this.incrementVersion(recipe.version);

    // Build update data as a single object using spreads to avoid mutating readonly properties
    const updateData: Partial<Recipe> = {
      version: newVersion,
      ...(data.title !== undefined && {
        title: data.title.trim(),
        canonicalId: this.generateCanonicalId(data.title.trim()),
      }),
      ...(data.description !== undefined && {
        description: data.description.trim(),
      }),
      ...(data.expectedDurationMinutes !== undefined && {
        expectedDurationMinutes: data.expectedDurationMinutes,
      }),
      ...(data.moduleId !== undefined && {
        moduleId: data.moduleId,
      }),
      ...(data.published !== undefined && {
        published: data.published,
      }),
    };

    await this.recipeRepository.update(id, updateData);

    return this.getRecipeById(id);
  }

  /**
   * Delete a recipe (soft delete via published flag)
   */
  async deleteRecipe(id: string, _userId: string, _isAdmin: boolean = false): Promise<void> {
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError(id);
    }

    // Soft delete: unpublish the recipe
    await this.recipeRepository.update(id, { published: false });
  }

  /**
   * Add a step to a recipe
   */
  async addStep(
    recipeId: string,
    stepData: CreateRecipeStepInput,
    userId: string,
  ): Promise<RecipeStep> {
    const recipe = await this.recipeRepository.findById(recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(recipeId);
    }
    // Ownership check (temporary: always true until createdBy is added to Recipe)
    if (!(await this.canManageRecipe(recipeId, userId))) {
      throw new RecipeOwnershipError(recipeId, userId);
    }

    // Get current max order
    const existingSteps = await this.recipeRepository.findStepsByRecipeId(recipeId);
    const maxOrder = existingSteps.length > 0 ? Math.max(...existingSteps.map((s) => s.order)) : -1;

    // Ensure atomId is present, creating a new Atom if needed
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
      script: stepData.script, // Store the script directly for easy retrieval
      stepType: stepData.stepType || 'content',
    });

    return step;
  }

  /**
   * Update a step
   */
  async updateStep(
    stepId: string,
    stepData: UpdateRecipeStepInput,
    userId: string,
  ): Promise<RecipeStep> {
    const existingStep = await this.recipeRepository.findStepById(stepId);
    if (!existingStep) {
      throw new StepNotFoundError(stepId);
    }
    const recipeId = existingStep.recipeId;
    const recipe = await this.recipeRepository.findById(recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(recipeId);
    }

    if (!(await this.canManageRecipe(recipeId, userId))) {
      throw new RecipeOwnershipError(recipeId, userId);
    }

    // Determine the effective stepType for content consolidation
    const effectiveStepType = stepData.stepType || existingStep.stepType || 'content';

    // Consolidate content from stepData (script, activity, question) into a single script JSON
    let newScriptContent: Record<string, unknown> | undefined;
    if (stepData.script !== undefined) {
      newScriptContent = stepData.script || undefined;
    } else if (stepData.activity !== undefined) {
      newScriptContent = stepData.activity || undefined;
    } else if (stepData.question !== undefined) {
      newScriptContent = stepData.question || undefined;
    } else {
      // If no content provided in stepData, retain existing content from script if present
      newScriptContent = existingStep.script;
    }

    // Ensure Atom is updated or created if content changes
    const effectiveAtomId = await this.ensureAtomForStep(
      effectiveStepType,
      // Pass consolidated new content for the Atom
      newScriptContent &&
        (effectiveStepType === 'content' ||
          effectiveStepType === 'intro' ||
          effectiveStepType === 'closure')
        ? newScriptContent
        : undefined,
      newScriptContent && effectiveStepType === 'activity' ? newScriptContent : undefined,
      newScriptContent && effectiveStepType === 'question' ? newScriptContent : undefined,
      existingStep.atomId, // Pass existing atomId to update it
    );

    // Build update data for the RecipeStep using conditional spreads to omit undefined
    const updateData: Partial<RecipeStep> = {
      atomId: effectiveAtomId,
      stepType: effectiveStepType,
      ...(stepData.order !== undefined && { order: stepData.order }),
      ...(stepData.condition !== undefined && { condition: stepData.condition }),
      ...(stepData.onCondition !== undefined && { onCondition: stepData.onCondition }),
      ...(stepData.conceptId !== undefined && { conceptId: stepData.conceptId }),
      ...(stepData.activityId !== undefined && { activityId: stepData.activityId }),
      ...(newScriptContent !== undefined && { script: newScriptContent }),
    };

    const updated = await this.recipeRepository.updateStep(stepId, updateData);
    return updated;
  }

  /**
   * Delete a step
   */
  async deleteStep(stepId: string, _userId: string): Promise<void> {
    // Find the step and verify recipe ownership
    const allRecipes = await this.recipeRepository.findAll();

    let foundRecipeId: string | null = null;

    for (const recipe of allRecipes) {
      const recipeSteps = await this.recipeRepository.findStepsByRecipeId(recipe.id);
      const step = recipeSteps.find((s) => s.id === stepId);
      if (step) {
        foundRecipeId = recipe.id;
        break;
      }
    }

    if (!foundRecipeId) {
      throw new StepNotFoundError(stepId);
    }

    // Check recipe exists
    const recipe = await this.recipeRepository.findById(foundRecipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(foundRecipeId);
    }

    await this.recipeRepository.deleteStep(stepId);
  }

  /**
   * Reorder steps within a recipe
   */
  async reorderSteps(recipeId: string, stepIds: string[], _userId: string): Promise<void> {
    const recipe = await this.recipeRepository.findById(recipeId);
    if (!recipe) {
      throw new RecipeNotFoundError(recipeId);
    }

    // Verify all steps belong to this recipe
    const steps = await this.recipeRepository.findStepsByRecipeId(recipeId);
    const stepIdSet = new Set(steps.map((s) => s.id));

    for (const id of stepIds) {
      if (!stepIdSet.has(id)) {
        throw new StepNotFoundError(id);
      }
    }

    // Use a transaction to update all steps atomically
    // First, temporarily set all orders to negative values to avoid unique constraint conflicts
    const originalOrders = new Map<string, number>();
    for (let i = 0; i < stepIds.length; i++) {
      const step = steps.find((s) => s.id === stepIds[i]);
      if (step) {
        originalOrders.set(stepIds[i], step.order);
        // Temporarily set to negative value
        await this.recipeRepository.updateStep(stepIds[i], { order: -(i + 1) });
      }
    }

    // Then set the final order values
    for (let i = 0; i < stepIds.length; i++) {
      await this.recipeRepository.updateStep(stepIds[i], { order: i });
    }
  }

  /**
   * List recipes (with optional filters)
   */
  async listRecipes(options?: { published?: boolean; moduleId?: string }): Promise<Recipe[]> {
    if (options?.published !== undefined) {
      const recipes = options.published
        ? await this.recipeRepository.findPublished()
        : await this.recipeRepository.findAll();
      return recipes;
    }
    return this.recipeRepository.findAll();
  }
}
