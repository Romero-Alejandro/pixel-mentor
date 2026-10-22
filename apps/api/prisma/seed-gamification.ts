/**
 * Gamification Seed Script
 *
 * Writes the canonical badge and level catalog to the database.
 * Definitions live in `src/features/gamification/domain/gamification-catalog.ts`
 * so the seed and the code that awards badges can never drift apart.
 *
 * Usage:
 *   pnpm db:seed:gamification
 */

import { PrismaClient } from '../src/database/client.js';
import type { Prisma } from '../src/database/client.js';
import {
  GAMIFICATION_BADGES,
  GAMIFICATION_LEVELS,
} from '../src/features/gamification/domain/gamification-catalog.js';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding gamification data...');

  for (const badge of GAMIFICATION_BADGES) {
    // Prisma's Json input type requires an index signature; the catalog keeps
    // the stricter BadgeRequirement shape for compile-time safety elsewhere.
    const data = {
      ...badge,
      rules: badge.rules as unknown as Prisma.InputJsonValue,
    };

    await prisma.badge.upsert({
      where: { code: badge.code },
      update: data,
      create: data,
    });
    console.log(`  ✅ Badge: ${badge.code}`);
  }

  for (const level of GAMIFICATION_LEVELS) {
    await prisma.levelConfig.upsert({
      where: { level: level.level },
      update: level,
      create: level,
    });
    console.log(`  ✅ Level: ${level.level} - ${level.title}`);
  }

  console.log('✨ Seeding complete!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
