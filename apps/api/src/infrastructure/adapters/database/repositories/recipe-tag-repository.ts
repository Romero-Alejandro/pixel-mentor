import { prisma } from '../client.js';
import type { RecipeTag } from '@/domain/entities/recipe-tag.js';
import type { RecipeTagRepository } from '@/domain/ports/recipe-tag-repository.js';

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

  private mapToDomain(raw: any): RecipeTag {
    return {
      recipeId: raw.recipeId,
      tagId: raw.tagId,
    };
  }
}
