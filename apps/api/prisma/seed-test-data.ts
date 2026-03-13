import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaClient } from '../src/infrastructure/adapters/database/client.js';

const prisma = new PrismaClient();

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

async function main() {
  console.log('🌱 Starting database seed for testing...');

  const TEST_RECIPE_ID = randomUUID();
  const TEST_STUDENT_ID = randomUUID();
  const TEST_TEACHER_ID = randomUUID();

  const studentPasswordHash = await argon2.hash('testpassword123', HASH_OPTIONS);
  const teacherPasswordHash = await argon2.hash('testpassword123', HASH_OPTIONS);

  try {
    // 1. Delete existing test data
    await prisma.interaction.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProgress.deleteMany();
    await prisma.activityAttempt.deleteMany();
    await prisma.eventLog.deleteMany();
    await prisma.knowledgeChunk.deleteMany();
    await prisma.atomOption.deleteMany();
    await prisma.atom.deleteMany();
    await prisma.recipeStep.deleteMany({ where: { recipeId: TEST_RECIPE_ID } });
    await prisma.recipe.deleteMany({ where: { id: TEST_RECIPE_ID } });
    await prisma.$executeRaw`
      DELETE FROM "users"
      WHERE "email" IN ('student@test.pixel-mentor', 'teacher@test.pixel-mentor')
    `;
    console.log('🗑️  Cleared previous test data');

    // 2. Create test student
    await prisma.user.create({
      data: {
        id: TEST_STUDENT_ID,
        email: 'student@test.pixel-mentor',
        passwordHash: studentPasswordHash,
        name: 'Student Test',
        role: 'STUDENT',
        age: 10,
        quota: 100,
      },
    });
    console.log('✅ Created test student:', TEST_STUDENT_ID);

    // 3. Create test teacher
    await prisma.user.create({
      data: {
        id: TEST_TEACHER_ID,
        email: 'teacher@test.pixel-mentor',
        passwordHash: teacherPasswordHash,
        name: 'Teacher Test',
        role: 'TEACHER',
      },
    });
    console.log('✅ Created test teacher:', TEST_TEACHER_ID);

    // 4. Create test recipe
    await prisma.recipe.create({
      data: {
        id: TEST_RECIPE_ID,
        canonicalId: 'math-basics-es-AR',
        title: 'Matemáticas Básicas: Suma y Resta',
        description: 'Lección introductoria sobre operaciones aritméticas básicas para niños.',
        expectedDurationMinutes: 15,
        version: '1.0.0',
        published: true,
      },
    });
    console.log('✅ Created test recipe:', TEST_RECIPE_ID);

    // 5. Create atoms and recipe steps
    // Step 1: Microllecture about addition
    const atom1Id = randomUUID();
    await prisma.atom.create({
      data: {
        id: atom1Id,
        canonicalId: 'intro-addition',
        title: 'Introducción a la Suma',
        description: 'Aprende a sumar cantidades de forma divertida',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: {
          text: 'La suma es juntar cosas. Ejemplo: 2 manzanas + 3 manzanas = 5 manzanas.',
        },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: TEST_RECIPE_ID,
        atomId: atom1Id,
        order: 0,
      },
    });
    await prisma.knowledgeChunk.create({
      data: {
        id: randomUUID(),
        atomId: atom1Id,
        index: 0,
        chunkText: 'La suma es la operación de juntar cantidades. Se representa con el signo +.',
      },
    });
    console.log('  ✓ Created step 1: Microllecture + knowledge chunk');

    // Step 2: Mini quiz about addition
    const atom2Id = randomUUID();
    await prisma.atom.create({
      data: {
        id: atom2Id,
        canonicalId: 'quiz-addition',
        title: 'Quiz: Suma de manzanas',
        description: 'Pregunta de suma',
        type: 'MINI_QUIZ',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: TEST_RECIPE_ID,
        atomId: atom2Id,
        order: 1,
      },
    });
    await prisma.atomOption.createMany({
      data: [
        { id: randomUUID(), atomId: atom2Id, text: '5', isCorrect: true, order: 0 },
        { id: randomUUID(), atomId: atom2Id, text: '3', isCorrect: false, order: 1 },
        { id: randomUUID(), atomId: atom2Id, text: '7', isCorrect: false, order: 2 },
      ],
    });
    console.log('  ✓ Created step 2: Mini quiz with options');

    // Step 3: Microllecture about subtraction
    const atom3Id = randomUUID();
    await prisma.atom.create({
      data: {
        id: atom3Id,
        canonicalId: 'intro-subtraction',
        title: 'Introducción a la Resta',
        description: 'Aprende a restar cantidades',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: {
          text: 'La resta es quitar cosas. Ejemplo: 5 manzanas - 2 manzanas = 3 manzanas.',
        },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: TEST_RECIPE_ID,
        atomId: atom3Id,
        order: 2,
      },
    });
    await prisma.knowledgeChunk.create({
      data: {
        id: randomUUID(),
        atomId: atom3Id,
        index: 0,
        chunkText: 'La resta es la operación de quitar cantidades. Se representa con el signo -.',
      },
    });
    console.log('  ✓ Created step 3: Microllecture + knowledge chunk');

    // Step 4: Mini quiz about subtraction
    const atom4Id = randomUUID();
    await prisma.atom.create({
      data: {
        id: atom4Id,
        canonicalId: 'quiz-subtraction',
        title: 'Quiz: Resta de caramelos',
        description: 'Pregunta de resta',
        type: 'MINI_QUIZ',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: TEST_RECIPE_ID,
        atomId: atom4Id,
        order: 3,
      },
    });
    await prisma.atomOption.createMany({
      data: [
        { id: randomUUID(), atomId: atom4Id, text: '3', isCorrect: true, order: 0 },
        { id: randomUUID(), atomId: atom4Id, text: '2', isCorrect: false, order: 1 },
        { id: randomUUID(), atomId: atom4Id, text: '4', isCorrect: false, order: 2 },
      ],
    });
    console.log('  ✓ Created step 4: Mini quiz with options');

    // 6. Create a test session for the student
    const sessionId = randomUUID();
    await prisma.session.create({
      data: {
        id: sessionId,
        studentId: TEST_STUDENT_ID,
        recipeId: TEST_RECIPE_ID,
        status: 'IDLE',
        stateCheckpoint: {
          currentState: 'ACTIVE_CLASS',
          currentStepIndex: 0,
        },
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
    console.log('✅ Created test session:', sessionId);

    // 7. Create initial interaction (tutor explanation)
    await prisma.interaction.create({
      data: {
        id: randomUUID(),
        sessionId,
        turnNumber: 1,
        transcript: '¡Hola! Vamos a aprender sumas y restas.',
        aiResponse: {
          text: '¡Hola! Vamos a aprender sumas y restas.',
          responseType: 'explanation',
        },
        pausedForQuestion: false,
      },
    });
    console.log('✅ Created initial interaction');

    // 8. Create user progress entry
    await prisma.userProgress.create({
      data: {
        id: randomUUID(),
        userId: TEST_STUDENT_ID,
        recipeId: TEST_RECIPE_ID,
        status: 'IN_PROGRESS',
        attempts: 0,
      },
    });
    console.log('✅ Created user progress');

    // 9. Create an activity attempt (example)
    await prisma.activityAttempt.create({
      data: {
        id: randomUUID(),
        userId: TEST_STUDENT_ID,
        atomId: atom2Id,
        response: '5',
        correct: true,
        attemptNo: 1,
      },
    });
    console.log('✅ Created activity attempt');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Test data created with these UUIDs:');
    console.log(`  Recipe ID: ${TEST_RECIPE_ID}`);
    console.log(`  Student ID: ${TEST_STUDENT_ID}`);
    console.log(`  Teacher ID: ${TEST_TEACHER_ID}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log(
      '\n⚠️  Test credentials: student@test.pixel-mentor / teacher@test.pixel-mentor -> testpassword123',
    );
    console.log('\n💡 These IDs are used in automated tests. They are real UUIDs now.');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
