import { PrismaClient } from '../src/database/client.js';

const prisma = new PrismaClient();

const badges = [
  {
    code: 'FIRST_LESSON',
    name: 'Primera Lección',
    description: 'Completaste tu primera lección',
    icon: '🌱',
    xpReward: 10,
    rules: { type: 'LESSON_COUNT', value: 1 },
  },
  {
    code: 'STREAK_3',
    name: 'Racha de 3',
    description: '3 días consecutivos de aprendizaje',
    icon: '🔥',
    xpReward: 25,
    rules: { type: 'STREAK', value: 3 },
  },
  {
    code: 'PERFECT',
    name: 'Perfecto',
    description: 'Respondiste correctamente al primer intento',
    icon: '⭐',
    xpReward: 15,
    rules: { type: 'PERFECT_ATTEMPT', value: 1 },
  },
  {
    code: 'LESSON_5',
    name: 'Lecturista',
    description: 'Completaste 5 lecciones',
    icon: '📚',
    xpReward: 50,
    rules: { type: 'LESSON_COUNT', value: 5 },
  },
  {
    code: 'LEVEL_5',
    name: 'Maestro',
    description: 'Alcanzaste el nivel 5',
    icon: '🏆',
    xpReward: 100,
    rules: { type: 'LEVEL', value: 5 },
  },
];

const levels = [
  { level: 1, title: 'Semilla', description: 'El comienzo de tu aventura', minXP: 0, icon: '🌱' },
  { level: 2, title: 'Brote', description: 'Está creciendo', minXP: 100, icon: '🌿' },
  { level: 3, title: 'Flor', description: '¡Hermoso!', minXP: 250, icon: '🌸' },
  { level: 4, title: 'Árbol', description: 'Muy fuerte', minXP: 500, icon: '🌳' },
  { level: 5, title: 'Bosque', description: '¡Imparable!', minXP: 1000, icon: '🌲' },
  { level: 6, title: 'Campeón', description: '¡LEYENDA!', minXP: 2000, icon: '🏆' },
];

async function seed() {
  console.log('🌱 Seeding gamification data...');

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: badge,
      create: badge,
    });
    console.log(`  ✅ Badge: ${badge.code}`);
  }

  for (const level of levels) {
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
