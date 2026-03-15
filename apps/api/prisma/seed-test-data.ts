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
    // 1. Delete existing test data (in correct order to avoid FK violations)
    await prisma.recipeStep.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.concept.deleteMany();
    await prisma.interaction.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProgress.deleteMany();
    await prisma.activityAttempt.deleteMany();
    await prisma.eventLog.deleteMany();
    await prisma.knowledgeChunk.deleteMany();
    await prisma.atomOption.deleteMany();
    await prisma.atom.deleteMany();
    await prisma.recipe.deleteMany();
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

    // 4. Create test recipe: Mathematics Basics
    const MATH_RECIPE_ID = randomUUID();
    await prisma.recipe.create({
      data: {
        id: MATH_RECIPE_ID,
        canonicalId: 'math-basics-es-AR',
        title: 'Matemáticas Básicas: Suma y Resta',
        description:
          'Lección introductoria sobre operaciones aritméticas básicas para niños de 6-8 años.',
        expectedDurationMinutes: 15,
        version: '1.0.0',
        published: true,
      },
    });
    console.log('✅ Created test recipe: Math Basics');

    // 4.1 Create Concepts for Math Lesson
    const additionConceptId = randomUUID();
    await prisma.concept.create({
      data: {
        id: additionConceptId,
        recipeId: MATH_RECIPE_ID,
        title: 'La Suma',
        order: 0,
        introduction: {
          text: '¡Hoy vamos a aprender a sumar! La suma nos ayuda a contar cuántas cosas tenemos cuando las juntamos.',
          duration: 30,
        },
        explanation: {
          text: 'Sumar es como juntar cosas. Cuando tienes 2 manzanas y te dan 3 más, ¿cuántas tienes? ¡5! Usamos el símbolo + que se lee "más".',
          chunks: [
            { text: 'La suma sirve para juntar cantidades', pauseAfter: 3 },
            { text: 'El signo + significa "más" o "juntar"', pauseAfter: 3 },
            { text: '2 + 3 = 5 se lee "dos más tres es igual a cinco"', pauseAfter: 4 },
          ],
        },
        examples: [
          {
            text: '2 + 1 = 3 (dos cuadernos más uno son tres)',
            visual: { type: 'math', src: 'addition-1' },
          },
          {
            text: '3 + 2 = 5 (tres fichas más dos son cinco)',
            visual: { type: 'math', src: 'addition-2' },
          },
          {
            text: '4 + 1 = 5 (cuatro velas más una son cinco)',
            visual: { type: 'math', src: 'addition-3' },
          },
        ],
        keyPoints: [
          'Sumar es juntar cosas',
          'El símbolo + significa "más"',
          'El resultado de sumar se llama "total"',
        ],
        closure: {
          text: '¡Muy bien! Ahora sabes sumar. Cuando juntamos cantidades, usamos el signo + y el resultado es el total.',
        },
      },
    });

    const subtractionConceptId = randomUUID();
    await prisma.concept.create({
      data: {
        id: subtractionConceptId,
        recipeId: MATH_RECIPE_ID,
        title: 'La Resta',
        order: 1,
        introduction: {
          text: 'Ahora aprenderemos a restar. La resta nos ayuda a saber cuántas cosas quedan cuando quitamos algunas.',
          duration: 30,
        },
        explanation: {
          text: 'Restar es como quitar cosas. Si tienes 5 caramelos y comes 2, ¿cuántos quedan? ¡3! Usamos el símbolo - que se lee "menos".',
          chunks: [
            { text: 'La resta sirve para quitar cantidades', pauseAfter: 3 },
            { text: 'El signo - significa "menos" o "quitar"', pauseAfter: 3 },
            { text: '5 - 2 = 3 se lee "cinco menos dos es igual a tres"', pauseAfter: 4 },
          ],
        },
        examples: [
          {
            text: '5 - 1 = 4 (cinco moins uno quedan cuatro)',
            visual: { type: 'math', src: 'subtraction-1' },
          },
          {
            text: '4 - 2 = 2 (cuatro menos dos quedan dos)',
            visual: { type: 'math', src: 'subtraction-2' },
          },
          {
            text: '3 - 1 = 2 (tres menos uno quedan dos)',
            visual: { type: 'math', src: 'subtraction-3' },
          },
        ],
        keyPoints: [
          'Restar es quitar cosas',
          'El símbolo - significa "menos"',
          'El resultado de restar se llama "diferencia"',
        ],
        closure: {
          text: '¡Excelente! Ahora sabes restar. Cuando quitamos cantidades, usamos el signo - y el resultado es la diferencia.',
        },
      },
    });
    console.log('  ✓ Created concepts: Addition, Subtraction');

    // 4.2 Create Activities for Addition Concept
    const additionQuizId = randomUUID();
    await prisma.activity.create({
      data: {
        id: additionQuizId,
        conceptId: additionConceptId,
        type: 'QUIZ',
        order: 0,
        instruction: '¡Vamos a practicar! Si tienes 2 manzanas y te dan 3 más, ¿cuántas tienes?',
        options: [
          { text: '5', isCorrect: true },
          { text: '3', isCorrect: false },
          { text: '6', isCorrect: false },
        ],
        correctAnswer: '5',
        feedback: {
          correct: '¡Correcto! 2 + 3 = 5. ¡Muy bien!',
          incorrect: '¡Casi! Piensa: ¿cuántas cosas tienes si juntas 2 con 3?',
          partial: 'Intenta contar con tus dedos: 1, 2 (los que tienes) + 1, 2, 3 (los que te dan)',
        },
      },
    });

    const additionPracticeId = randomUUID();
    await prisma.activity.create({
      data: {
        id: additionPracticeId,
        conceptId: additionConceptId,
        type: 'PRACTICE',
        order: 1,
        instruction: 'Ahora es tu turno: ¿cuánto es 4 + 1?',
        correctAnswer: '5',
        feedback: {
          correct: '¡Perfecto! 4 + 1 = 5',
          incorrect: 'Pista: cuenta 4 cosas y agrega 1 más',
          partial: 'Casi, sigue contando desde 4',
        },
      },
    });
    console.log('  ✓ Created activities for Addition concept');

    // 4.3 Create Activities for Subtraction Concept
    const subtractionQuizId = randomUUID();
    await prisma.activity.create({
      data: {
        id: subtractionQuizId,
        conceptId: subtractionConceptId,
        type: 'QUIZ',
        order: 0,
        instruction: '¡Vamos a restar! Si tienes 5 caramelos y comes 2, ¿cuántos quedan?',
        options: [
          { text: '3', isCorrect: true },
          { text: '2', isCorrect: false },
          { text: '4', isCorrect: false },
        ],
        correctAnswer: '3',
        feedback: {
          correct: '¡Muy bien! 5 - 2 = 3. ¡Eres un experto!',
          incorrect: '¡Intenta de nuevo! Si tienes 5 y quitas 2, ¿cuántos quedan?',
          partial: 'Cuenta hacia atrás: 5... 4, 3',
        },
      },
    });

    const subtractionPracticeId = randomUUID();
    await prisma.activity.create({
      data: {
        id: subtractionPracticeId,
        conceptId: subtractionConceptId,
        type: 'PRACTICE',
        order: 1,
        instruction: 'Ahora tu turno: ¿cuánto es 4 - 2?',
        correctAnswer: '2',
        feedback: {
          correct: '¡Excelente! 4 - 2 = 2',
          incorrect: 'Pista: quitamos 2 de 4',
          partial: 'Cuenta hacia atrás desde 4: 3, 2',
        },
      },
    });
    console.log('  ✓ Created activities for Subtraction concept');

    // 4.4 Create Recipe Steps with static content (concepts and activities)
    // Step 0: Introduction to the lesson
    const introStepId = randomUUID();
    const introAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: introAtomId,
        canonicalId: 'intro-math-lesson',
        title: 'Bienvenida a Matemáticas',
        description: 'Introducción a la lección de sumas y restas',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: '¡Hola! Vamos a aprender matemáticas jugando.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: introStepId,
        recipeId: MATH_RECIPE_ID,
        atomId: introAtomId,
        conceptId: additionConceptId,
        order: 0,
        stepType: 'intro',
        script: {
          transition: '¡Bienvenido a tu clase de matemáticas de hoy!',
          content: 'Hoy vamos a aprender dos operaciones muy importantes: la suma y la resta.',
          examples: [],
          closure: '¡Vamos a empezar con la suma!',
        },
      },
    });

    // Step 1: Addition Concept (Introduction)
    const addConceptStepId = randomUUID();
    const addConceptAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: addConceptAtomId,
        canonicalId: 'intro-addition',
        title: 'Introducción a la Suma',
        description: 'Aprende a sumar cantidades de forma divertida',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: 'La suma es juntar cosas.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: addConceptStepId,
        recipeId: MATH_RECIPE_ID,
        atomId: addConceptAtomId,
        conceptId: additionConceptId,
        order: 1,
        stepType: 'content',
        script: {
          transition: '¿Sabías que podemos juntar cosas?',
          content: 'La suma es la operación de juntar cantidades. Se representa con el signo +.',
          examples: ['2 + 1 = 3', '3 + 2 = 5'],
          closure: '¿Listo para un desafío?',
        },
      },
    });

    // Step 2: Addition Quiz Activity
    const addQuizStepId = randomUUID();
    const addQuizAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: addQuizAtomId,
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
        id: addQuizStepId,
        recipeId: MATH_RECIPE_ID,
        atomId: addQuizAtomId,
        conceptId: additionConceptId,
        activityId: additionQuizId,
        order: 2,
        stepType: 'activity',
        script: {
          transition: 'Ahora vamos a practicar juntos',
          content: 'Si tienes 2 manzanas y te dan 3 más, ¿cuántas tienes?',
          examples: [],
          closure: '¡Muy bien!',
        },
      },
    });

    // Step 3: Subtraction Concept (Introduction)
    const subConceptStepId = randomUUID();
    const subConceptAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: subConceptAtomId,
        canonicalId: 'intro-subtraction',
        title: 'Introducción a la Resta',
        description: 'Aprende a restar cantidades',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: 'La resta es quitar cosas.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: subConceptStepId,
        recipeId: MATH_RECIPE_ID,
        atomId: subConceptAtomId,
        conceptId: subtractionConceptId,
        order: 3,
        stepType: 'content',
        script: {
          transition: 'Ahora vamos a aprender algo nuevo',
          content: 'La resta es la operación de quitar cantidades. Se representa con el signo -.',
          examples: ['5 - 2 = 3', '4 - 1 = 3'],
          closure: '¡Vamos a practicar!',
        },
      },
    });

    // Step 4: Subtraction Quiz Activity
    const subQuizStepId = randomUUID();
    const subQuizAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: subQuizAtomId,
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
        id: subQuizStepId,
        recipeId: MATH_RECIPE_ID,
        atomId: subQuizAtomId,
        conceptId: subtractionConceptId,
        activityId: subtractionQuizId,
        order: 4,
        stepType: 'activity',
        script: {
          transition: 'Es tu turno de restar',
          content: 'Si tienes 5 caramelos y comes 2, ¿cuántos quedan?',
          examples: [],
          closure: '¡Excelente trabajo!',
        },
      },
    });

    console.log('  ✓ Created 5 recipe steps with static content');

    // ============================================================
    // 5. Create second recipe: Shapes Lesson
    // ============================================================
    const SHAPES_RECIPE_ID = randomUUID();
    await prisma.recipe.create({
      data: {
        id: SHAPES_RECIPE_ID,
        canonicalId: 'shapes-es-AR',
        title: 'Figuras Geométricas: Círculos, Cuadrados y Triángulos',
        description: 'Aprende a reconocer y nombrar las figuras básicas de la geometría.',
        expectedDurationMinutes: 12,
        version: '1.0.0',
        published: true,
      },
    });
    console.log('✅ Created test recipe: Shapes');

    // 5.1 Create Concepts for Shapes Lesson
    const circleConceptId = randomUUID();
    await prisma.concept.create({
      data: {
        id: circleConceptId,
        recipeId: SHAPES_RECIPE_ID,
        title: 'El Círculo',
        order: 0,
        introduction: {
          text: '¡Vamos a conocer las figuras! Primero aprenderemos sobre el círculo.',
          duration: 25,
        },
        explanation: {
          text: 'El círculo es una figura muy especial. No tiene esquinas ni lados. ¡Parece una pelota o el sol!',
          chunks: [
            { text: 'El círculo no tiene esquinas', pauseAfter: 3 },
            { text: 'Es redondo por todas partes', pauseAfter: 3 },
            { text: 'Parece una pelota o el sol', pauseAfter: 3 },
          ],
        },
        examples: [
          { text: 'Una pelota es como un círculo', visual: { type: 'shape', src: 'ball' } },
          { text: 'El sol es como un círculo', visual: { type: 'shape', src: 'sun' } },
          { text: 'Una moneda es como un círculo', visual: { type: 'shape', src: 'coin' } },
        ],
        keyPoints: [
          'El círculo no tiene esquinas',
          'Es redondo por todas partes',
          'Parece una pelota o el sol',
        ],
        closure: {
          text: '¡Muy bien! Ahora conoces el círculo.',
        },
      },
    });

    const squareConceptId = randomUUID();
    await prisma.concept.create({
      data: {
        id: squareConceptId,
        recipeId: SHAPES_RECIPE_ID,
        title: 'El Cuadrado',
        order: 1,
        introduction: {
          text: 'Ahora vamos a conocer otra figura: ¡el cuadrado!',
          duration: 25,
        },
        explanation: {
          text: 'El cuadrado tiene 4 lados iguales y 4 esquinas. Parece una ventana o una caja.',
          chunks: [
            { text: 'El cuadrado tiene 4 lados', pauseAfter: 3 },
            { text: 'Todos los lados son iguales', pauseAfter: 3 },
            { text: 'Tiene 4 esquinas', pauseAfter: 3 },
          ],
        },
        examples: [
          { text: 'Una ventana parece un cuadrado', visual: { type: 'shape', src: 'window' } },
          { text: 'Un cubo tiene cuadrados', visual: { type: 'shape', src: 'cube' } },
          { text: 'Un cuadro en la pared', visual: { type: 'shape', src: 'painting' } },
        ],
        keyPoints: [
          'El cuadrado tiene 4 lados',
          'Todos los lados miden lo mismo',
          'Tiene 4 esquinas',
        ],
        closure: {
          text: '¡Perfecto! Ya conoces el cuadrado.',
        },
      },
    });

    const triangleConceptId = randomUUID();
    await prisma.concept.create({
      data: {
        id: triangleConceptId,
        recipeId: SHAPES_RECIPE_ID,
        title: 'El Triángulo',
        order: 2,
        introduction: {
          text: '¡Vamos a conocer una figura muy especial: el triángulo!',
          duration: 25,
        },
        explanation: {
          text: 'El triángulo tiene 3 lados y 3 esquinas. Parece un pendiente o una rebanada de pizza.',
          chunks: [
            { text: 'El triángulo tiene 3 lados', pauseAfter: 3 },
            { text: 'Tiene 3 esquinas', pauseAfter: 3 },
            { text: 'Parece un pendiente o una pizza', pauseAfter: 3 },
          ],
        },
        examples: [
          {
            text: 'Un pendiente tiene forma de triángulo',
            visual: { type: 'shape', src: 'earring' },
          },
          { text: 'Una rebanada de pizza', visual: { type: 'shape', src: 'pizza' } },
          { text: 'Unute de tránsito', visual: { type: 'shape', src: 'sign' } },
        ],
        keyPoints: [
          'El triángulo tiene 3 lados',
          'Tiene 3 esquinas',
          'Parece un pendiente o pizza',
        ],
        closure: {
          text: '¡Excelente! Ya conoces el triángulo.',
        },
      },
    });
    console.log('  ✓ Created concepts: Circle, Square, Triangle');

    // 5.2 Create Activities for Shapes Concepts
    const circleQuizId = randomUUID();
    await prisma.activity.create({
      data: {
        id: circleQuizId,
        conceptId: circleConceptId,
        type: 'QUIZ',
        order: 0,
        instruction: '¿Cuál de estas cosas tiene forma de círculo?',
        options: [
          { text: 'Una pelota', isCorrect: true },
          { text: 'Una caja', isCorrect: false },
          { text: 'Unute de tránsito', isCorrect: false },
        ],
        correctAnswer: 'Una pelota',
        feedback: {
          correct: '¡Correcto! La pelota es como un círculo.',
          incorrect: '¡Intenta de nuevo! ¿Cuál es redondita?',
          partial: 'Pista: el círculo es redondo, sin esquinas',
        },
      },
    });

    const squareQuizId = randomUUID();
    await prisma.activity.create({
      data: {
        id: squareQuizId,
        conceptId: squareConceptId,
        type: 'QUIZ',
        order: 0,
        instruction: '¿Cuántas esquinas tiene un cuadrado?',
        options: [
          { text: '4', isCorrect: true },
          { text: '3', isCorrect: false },
          { text: '5', isCorrect: false },
        ],
        correctAnswer: '4',
        feedback: {
          correct: '¡Muy bien! El cuadrado tiene 4 esquinas.',
          incorrect: '¡Piénsalo de nuevo! Cuenta las esquinas de una ventana.',
          partial: 'Mira una ventana: tiene una esquina en cada lado',
        },
      },
    });

    const triangleQuizId = randomUUID();
    await prisma.activity.create({
      data: {
        id: triangleQuizId,
        conceptId: triangleConceptId,
        type: 'QUIZ',
        order: 0,
        instruction: '¿Cuál de estas cosas tiene forma de triángulo?',
        options: [
          { text: 'Una rebanada de pizza', isCorrect: true },
          { text: 'Una moneda', isCorrect: false },
          { text: 'Una ventana', isCorrect: false },
        ],
        correctAnswer: 'Una rebanada de pizza',
        feedback: {
          correct: '¡Exacto! La pizza tiene forma de triángulo.',
          incorrect: '¡Intenta de nuevo! ¿Cuál tiene 3 esquinas?',
          partial: 'Pista: el triángulo tiene 3 lados y 3 esquinas',
        },
      },
    });
    console.log('  ✓ Created activities for Shapes concepts');

    // 5.3 Create Recipe Steps for Shapes
    // Intro step
    const shapesIntroAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: shapesIntroAtomId,
        canonicalId: 'intro-shapes',
        title: 'Bienvenida a Figuras',
        description: 'Introducción a la lección de figuras',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: '¡Hola! Vamos a aprender sobre las figuras.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: SHAPES_RECIPE_ID,
        atomId: shapesIntroAtomId,
        conceptId: circleConceptId,
        order: 0,
        stepType: 'intro',
        script: {
          transition: '¡Bienvenido a tu clase de figuras!',
          content:
            'Hoy vamos a conocer tres figuras muy importantes: el círculo, el cuadrado y el triángulo.',
          examples: [],
          closure: '¡Empecemos con el círculo!',
        },
      },
    });

    // Circle concept step
    const circleAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: circleAtomId,
        canonicalId: 'intro-circle',
        title: 'El Círculo',
        description: 'Aprende sobre el círculo',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: 'El círculo es round.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: SHAPES_RECIPE_ID,
        atomId: circleAtomId,
        conceptId: circleConceptId,
        order: 1,
        stepType: 'content',
        script: {
          transition: '¿Qué figura es esta?',
          content:
            'El círculo es una figura especial. No tiene esquinas y es redondo por todas partes.',
          examples: ['Una pelota', 'El sol', 'Una moneda'],
          closure: '¿Listo para la siguiente figura?',
        },
      },
    });

    // Circle activity step
    const circleActivityAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: circleActivityAtomId,
        canonicalId: 'quiz-circle',
        title: 'Quiz: ¿Qué tiene forma de círculo?',
        description: 'Identifica círculos',
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
        recipeId: SHAPES_RECIPE_ID,
        atomId: circleActivityAtomId,
        conceptId: circleConceptId,
        activityId: circleQuizId,
        order: 2,
        stepType: 'activity',
        script: {
          transition: '¡Vamos a practicar!',
          content: '¿Cuál de estas cosas tiene forma de círculo?',
          examples: [],
          closure: '¡Muy bien!',
        },
      },
    });

    // Square concept step
    const squareAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: squareAtomId,
        canonicalId: 'intro-square',
        title: 'El Cuadrado',
        description: 'Aprende sobre el cuadrado',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: 'El cuadrado tiene 4 lados iguales.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: SHAPES_RECIPE_ID,
        atomId: squareAtomId,
        conceptId: squareConceptId,
        order: 3,
        stepType: 'content',
        script: {
          transition: '¡Vamos a otra figura!',
          content: 'El cuadrado tiene 4 lados y todos miden lo mismo. Tiene 4 esquinas.',
          examples: ['Una ventana', 'Un cuadro', 'Un dado'],
          closure: '¡Muy interesante!',
        },
      },
    });

    // Square activity step
    const squareActivityAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: squareActivityAtomId,
        canonicalId: 'quiz-square',
        title: 'Quiz: ¿Cuántas esquinas tiene el cuadrado?',
        description: 'Pregunta sobre cuadrados',
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
        recipeId: SHAPES_RECIPE_ID,
        atomId: squareActivityAtomId,
        conceptId: squareConceptId,
        activityId: squareQuizId,
        order: 4,
        stepType: 'activity',
        script: {
          transition: '¡Es tu turno!',
          content: '¿Cuántas esquinas tiene un cuadrado?',
          examples: [],
          closure: '¡Correcto!',
        },
      },
    });

    // Triangle concept step
    const triangleAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: triangleAtomId,
        canonicalId: 'intro-triangle',
        title: 'El Triángulo',
        description: 'Aprende sobre el triángulo',
        type: 'MICROLECTURE',
        locale: 'es-AR',
        difficulty: 1,
        version: '1.0.0',
        published: true,
        content: { text: 'El triángulo tiene 3 lados.' },
      },
    });
    await prisma.recipeStep.create({
      data: {
        id: randomUUID(),
        recipeId: SHAPES_RECIPE_ID,
        atomId: triangleAtomId,
        conceptId: triangleConceptId,
        order: 5,
        stepType: 'content',
        script: {
          transition: '¡Una figura más!',
          content: 'El triángulo tiene 3 lados y 3 esquinas. Parece un pendiente o una pizza.',
          examples: ['Una pizza', 'Un pendiente', 'Unute de tránsito'],
          closure: '¡Casi terminamos!',
        },
      },
    });

    // Triangle activity step
    const triangleActivityAtomId = randomUUID();
    await prisma.atom.create({
      data: {
        id: triangleActivityAtomId,
        canonicalId: 'quiz-triangle',
        title: 'Quiz: ¿Qué tiene forma de triángulo?',
        description: 'Identifica triángulos',
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
        recipeId: SHAPES_RECIPE_ID,
        atomId: triangleActivityAtomId,
        conceptId: triangleConceptId,
        activityId: triangleQuizId,
        order: 6,
        stepType: 'activity',
        script: {
          transition: '¡Último desafío!',
          content: '¿Cuál de estas cosas tiene forma de triángulo?',
          examples: [],
          closure: '¡Excelente trabajo!',
        },
      },
    });

    console.log('  ✓ Created 7 recipe steps for Shapes lesson');

    // ============================================================
    // 6. Update test references to use the math recipe
    // ============================================================
    const TEST_RECIPE_ID = MATH_RECIPE_ID;
    console.log('✅ Using Math Recipe as primary test recipe:', TEST_RECIPE_ID);

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
        atomId: addQuizAtomId,
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
