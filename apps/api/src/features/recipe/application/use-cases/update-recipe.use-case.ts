import type { RecipeRepository } from '../../domain/ports/recipe.repository.port.js';
import { RecipeNotFoundError, RecipeOwnershipError } from '@/shared/errors/domain-errors.js';
import { RecipeValidationError } from '@/shared/errors/domain-errors.js';
import { CanonicalId } from '../../domain/valueObjects/canonical-id.vo.js';
import { ExpectedDuration } from '../../domain/valueObjects/expected-duration.vo.js';
import type { Recipe } from '../../domain/entities/recipe.entity.js';

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
    const recipe = await this.recipeRepository.findById(id);
    if (!recipe) {
      throw new RecipeNotFoundError(id);
    }

    if (recipe.authorId !== userId) {
      throw new RecipeOwnershipError(id, userId);
    }

    const newVersion = recipe.version.incrementPatch().toString();

    const updateData: Record<string, unknown> = {
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

    if (data.expectedDurationMinutes !== undefined) {
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

    await this.recipeRepository.update(id, updateData as any);

    return this.recipeRepository.findByIdWithSteps(id) as Promise<Recipe>;
  }
}
