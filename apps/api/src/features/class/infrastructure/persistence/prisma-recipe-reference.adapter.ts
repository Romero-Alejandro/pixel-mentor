import { prisma } from '@/database/client.js';
import type { IRecipeReferencePort } from '@/features/class/domain/ports/recipe-reference.port.js';

/**
 * Prisma adapter for the class feature's recipe-reference port.
 * Verifies recipe existence without leaking recipe persistence details.
 */
export class PrismaRecipeReferenceAdapter implements IRecipeReferencePort {
  async findById(recipeId: string): Promise<{ id: string } | null> {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true },
    });
    return recipe ?? null;
  }
}
