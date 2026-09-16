// Persistence barrel
// PrismaConceptRepository is owned by the knowledge feature and re-exported
// here to keep the barrel surface stable (no duplicate adapter).
export * from '@/features/knowledge/infrastructure/persistence/prisma-concept.repository.js';
export * from '@/features/recipe/infrastructure/persistence/file-system-prompt.repository.js';
export * from '@/features/recipe/infrastructure/persistence/prisma-recipe.repository.js';
export * from '@/features/recipe/infrastructure/persistence/prisma-recipe-tag.repository.js';
export * from '@/features/recipe/infrastructure/persistence/prisma-tag.repository.js';
