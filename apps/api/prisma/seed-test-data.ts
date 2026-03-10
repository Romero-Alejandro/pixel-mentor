import { PrismaClient } from '../src/infrastructure/adapters/database/client.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for testing...');

  // Fixed UUIDs for predictable test data
  const TEST_LESSON_ID = '00000000-0000-0000-0000-000000000000';
  const TEST_STUDENT_ID = '11111111-1111-1111-1111-111111111111';
  const TEST_TEACHER_ID = '22222222-2222-2222-2222-222222222222';

  try {
    // 1. Delete existing test data to ensure clean state (reverse FK order)
    // Interactions -> Sessions -> LessonChunks -> Preguntas -> Leccion -> Users
    await prisma.interaction.deleteMany();
    await prisma.session.deleteMany();
    await prisma.lessonChunk.deleteMany({ where: { lessonId: TEST_LESSON_ID } });
    await prisma.pregunta.deleteMany({ where: { leccionId: TEST_LESSON_ID } });
    await prisma.leccion.deleteMany({ where: { id: TEST_LESSON_ID } });
    await prisma.user.deleteMany({ where: { id: { in: [TEST_STUDENT_ID, TEST_TEACHER_ID] } } });
    console.log('🗑️  Cleared previous test data');

    // 2. Create test student
    await prisma.user.create({
      data: {
        id: TEST_STUDENT_ID,
        email: 'student@test.pixel-mentor',
        password: 'hashed-placeholder-password',
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
        password: 'hashed-placeholder-password',
        name: 'Teacher Test',
        role: 'TEACHER',
      },
    });
    console.log('✅ Created test teacher:', TEST_TEACHER_ID);

    // 4. Create test lesson with fixed ID
    await prisma.leccion.create({
      data: {
        id: TEST_LESSON_ID,
        titulo: 'Matemáticas Básicas: Suma y Resta',
        descripcion: 'Lección introductoria sobre operaciones aritméticas básicas para niños.',
        conceptos: [
          {
            id: 'concept-1',
            title: 'Suma',
            description: 'La suma es la operación de juntar cantidades',
          },
          {
            id: 'concept-2',
            title: 'Resta',
            description: 'La resta es la operación de quitar cantidades',
          },
        ],
        analogias: [
          {
            id: 'analogy-1',
            title: 'Manzanas en una canasta',
            description: 'Si tienes 3 manzanas y agregas 2, ahora tienes 5',
          },
        ],
        erroresComunes: [
          {
            id: 'error-1',
            title: 'Confundir suma con resta',
            description: 'Algunos niños confunden cuando sumar o restar',
          },
        ],
        explicacionBase:
          'Las matemáticas son como un juego de juntar y quitar. Cuando sumas, juntas cosas. Cuando restas, quitas cosas. Es como si tuvieras dulces y tus amigos te dan más (suma) o te comes algunos (resta).',
        activa: true,
      },
    });
    console.log('✅ Created test lesson:', TEST_LESSON_ID);

    // 5. Create questions for the lesson
    const questions = [
      {
        id: 'q1-00000000-0000-0000-0000-000000000000',
        leccionId: TEST_LESSON_ID,
        texto: 'Si tienes 2 manzanas y tu mamá te compra 3 más, ¿cuántas manzanas tienes en total?',
        respuestaOk: '5',
        explicacion: 'Es una suma: 2 + 3 = 5 manzanas',
        orden: 0,
      },
      {
        id: 'q2-00000000-0000-0000-0000-000000000000',
        leccionId: TEST_LESSON_ID,
        texto: 'Tenía 5 caramelos y me comí 2. ¿Cuántos me quedan?',
        respuestaOk: '3',
        explicacion: 'Es una resta: 5 - 2 = 3 caramelos',
        orden: 1,
      },
      {
        id: 'q3-00000000-0000-0000-0000-000000000000',
        leccionId: TEST_LESSON_ID,
        texto: '¿Cuánto es 4 + 1?',
        respuestaOk: '5',
        explicacion: '4 + 1 = 5',
        orden: 2,
      },
    ];

    for (const q of questions) {
      await prisma.pregunta.create({
        data: q,
      });
      console.log('  ✓ Created question:', q.id);
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Use these UUIDs in your Bruno collection:');
    console.log(`  base_url: http://localhost:3001`);
    console.log(`  lesson_id: ${TEST_LESSON_ID}`);
    console.log(`  student_id: ${TEST_STUDENT_ID}`);
    console.log(`  teacher_id: ${TEST_TEACHER_ID}`);
    console.log(
      '\n⚠️  Note: Password is not hashed for test user. This is OK for local testing only.',
    );
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
