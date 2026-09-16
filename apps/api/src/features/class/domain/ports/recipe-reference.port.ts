/**
 * Outbound port: minimal recipe lookups needed by the class application layer.
 *
 * Keeps ClassService decoupled from the recipe feature's persistence details
 * (and from the prisma singleton). Implemented in class infrastructure.
 */
export interface IRecipeReferencePort {
  /** Returns the recipe's id if it exists, null otherwise. */
  findById(recipeId: string): Promise<{ id: string } | null>;
}
