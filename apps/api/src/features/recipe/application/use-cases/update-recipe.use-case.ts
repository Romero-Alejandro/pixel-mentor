import type {
  RecipeRepository,
  RecipeUpdateInput,
} from '@/features/recipe/domain/ports/recipe.repository.port.js';
import {
  RecipeNotFoundError,
  RecipeOwnershipError,
  RecipeValidationError,
} from '@/shared/errors/domain-errors.js';
import { CanonicalId } from '@/features/recipe/domain/value-objects/canonical-id.vo.js';
import { ExpectedDuration } from '@/features/recipe/domain/value-objects/expected-duration.vo.js';
import type { Recipe } from '@/features/recipe/domain/entities/recipe.entity.js';
import { moduleLogger } from '@/shared/logger/logger.js';

const logger = moduleLogger('recipe:update');

export interface UpdateRecipeInput {
  title?: string;
  description?: string;
  expectedDurationMinutes?: number;
  moduleId?: string;
  published?: boolean;
}

export class UpdateRecipeUseCase {
  constructor(private recipeRepository: RecipeRepository) {}

  async execute(id: string, data: UpdateRecipeInput, userId: string): Promise<Recipe> {
    logger.debug({ recipeId: id, userId }, 'UpdateRecipe starting');
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError(id);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(id, userId);
    }

    const newVersion = recipe.version.incrementPatch().toString();

    const updateData: RecipeUpdateInput = {
      version: newVersion,
    };

    if (data.title !== undefined) {
      const trimmedTitle = data.title.trim();
      if (!trimmedTitle) {
        throw new RecipeValidationError('Title cannot be empty');
      }
      updateData.title = trimmedTitle;
      updateData.canonicalId = CanonicalId.fromTitle(trimmedTitle).toString();
    }

    if (data.description !== undefined) {
      updateData.description = data.description.trim();
    }

    if (data.expectedDurationMinutes !== undefined && data.expectedDurationMinutes !== null) {
      updateData.expectedDurationMinutes = ExpectedDuration.create(
        data.expectedDurationMinutes,
      ).minutes;
    }

    if (data.moduleId !== undefined) {
      updateData.moduleId = data.moduleId;
    }

    if (data.published !== undefined) {
      updateData.published = data.published;
    }

    await this.recipeRepository.update(id, updateData);

    return this.recipeRepository.findByIdWithSteps(id) as Promise<Recipe>;
  }
}
