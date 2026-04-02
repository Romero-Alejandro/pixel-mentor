import { prisma } from '@/database/client';

import type { RecipeTag } from '@/features/recipe/domain/entities/recipe-tag.entity';
import type { RecipeTagRepository } from '@/features/recipe/domain/ports/recipe-tag.repository.port';

export class PrismaRecipeTagRepository implements RecipeTagRepository {
  async findByRecipeId(recipeId: string): Promise<RecipeTag[]> {
    const raw = await prisma.recipeTag.findMany({
      where: { recipeId },
    });
    return raw.map(this.mapToDomain);
  }

  async findByTagId(tagId: string): Promise<RecipeTag[]> {
    const raw = await prisma.recipeTag.findMany({
      where: { tagId },
    });
    return raw.map(this.mapToDomain);
  }

  async create(recipeTag: Omit<RecipeTag, 'id'>): Promise<RecipeTag> {
    const raw = await prisma.recipeTag.create({
      data: {
        recipeId: recipeTag.recipeId,
        tagId: recipeTag.tagId,
      },
    });
    return this.mapToDomain(raw);
  }

  async delete(recipeId: string, tagId: string): Promise<void> {
    await prisma.recipeTag.delete({
      where: {
        recipeId_tagId: {
          recipeId,
          tagId,
        },
      },
    });
  }

  private mapToDomain(raw: Record<string, unknown>): RecipeTag {
    return {
      recipeId: raw.recipeId as string,
      tagId: raw.tagId as string,
    };
  }
}
