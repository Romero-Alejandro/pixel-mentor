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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: builders de scripts auto-contenidos
// Cada RecipeStep lleva TODO lo necesario en su campo `script`.
// El orquestador no necesita consultas adicionales para ejecutar el paso.
// ─────────────────────────────────────────────────────────────────────────────

/** Paso introductorio / de cierre */
function introScript(transition: string, content: string, closure?: string) {
  return { transition, content, examples: [], closure: closure ?? '' };
}

/** Paso de contenido con ejemplos */
function contentScript(transition: string, content: string, examples: string[], closure: string) {
  return { transition, content, examples, closure };
}

/**
 * Paso de PREGUNTA DE COMPRENSIÓN (el tutor valida si el alumno entendió).
 * El alumno responde con texto libre; el LLM evalúa contra `expectedAnswer`.
 */
function questionScript(
  transition: string,
  question: string,
  expectedAnswer: string,
  hint: string,
  feedbackCorrect: string,
  feedbackIncorrect: string,
) {
  return {
    transition,
    question,
    expectedAnswer,
    hint,
    feedback: { correct: feedbackCorrect, incorrect: feedbackIncorrect },
  };
}

/**
 * Paso de ACTIVIDAD de opción múltiple.
 * El alumno elige entre opciones predefinidas; la evaluación es determinista.
 */
function activityScript(
  transition: string,
  instruction: string,
  options: Array<{ text: string; isCorrect: boolean }>,
  feedbackCorrect: string,
  feedbackIncorrect: string,
  closure?: string,
) {
  return {
    transition,
    instruction,
    options,
    feedback: { correct: feedbackCorrect, incorrect: feedbackIncorrect },
    closure: closure ?? '',
  };
}

/**
 * Paso de EXAMEN (opción múltiple, igual que activity pero marcado como exam).
 * Se diferencia en que el orquestador no muestra feedback hasta el final
 * y registra el puntaje.
 */
function examScript(
  transition: string,
  instruction: string,
  options: Array<{ text: string; isCorrect: boolean }>,
  feedbackCorrect: string,
  feedbackIncorrect: string,
) {
  return {
    transition,
    instruction,
    options,
    feedback: { correct: feedbackCorrect, incorrect: feedbackIncorrect },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Atoms helper — crea un Atom mínimo para anclar un RecipeStep
// ─────────────────────────────────────────────────────────────────────────────

async function createAtom(
  canonicalId: string,
  title: string,
  type: 'MICROLECTURE' | 'MINI_QUIZ' | 'MINI_ACTIVITY',
  content?: string,
) {
  const id = randomUUID();
  await prisma.atom.create({
    data: {
      id,
      canonicalId,
      title,
      type,
      locale: 'es-AR',
      difficulty: 1,
      version: '1.0.0',
      published: true,
      content: content ? { text: content } : undefined,
    },
  });
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...');

  const TEST_STUDENT_ID = randomUUID();
  const TEST_TEACHER_ID = randomUUID();

  const studentPasswordHash = await argon2.hash('testpassword123', HASH_OPTIONS);
  const teacherPasswordHash = await argon2.hash('testpassword123', HASH_OPTIONS);

  try {
    // ── Limpiar datos anteriores ────────────────────────────────────────────
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

    // ── Usuarios ────────────────────────────────────────────────────────────
    await prisma.user.create({
      data: {
        id: TEST_STUDENT_ID,
        email: 'student@test.pixel-mentor',
        passwordHash: studentPasswordHash,
        name: 'Valentina',
        role: 'STUDENT',
        age: 8,
        quota: 100,
      },
    });

    await prisma.user.create({
      data: {
        id: TEST_TEACHER_ID,
        email: 'teacher@test.pixel-mentor',
        passwordHash: teacherPasswordHash,
        name: 'Profe García',
        role: 'TEACHER',
      },
    });
    console.log('✅ Created users');

    // ═════════════════════════════════════════════════════════════════════════
    // RECIPE 1: Matemáticas Básicas — Suma y Resta
    //
    // Flujo de la clase:
    //   0. intro        — bienvenida
    //   1. content      — explicación de la suma
    //   2. question     — pregunta de comprensión ("¿Qué significa sumar?")
    //   3. activity     — práctica MCQ ("2 + 3 = ?")
    //   4. content      — explicación de la resta
    //   5. question     — pregunta de comprensión ("¿Qué signo usamos para restar?")
    //   6. activity     — práctica MCQ ("5 - 2 = ?")
    //   7. exam         — examen final MCQ ("4 + 3 = ?")
    //   8. closure      — cierre de la clase
    // ═════════════════════════════════════════════════════════════════════════

    const MATH_RECIPE_ID = randomUUID();
    await prisma.recipe.create({
      data: {
        id: MATH_RECIPE_ID,
        canonicalId: 'math-basics-es-AR',
        title: 'Matemáticas Básicas: Suma y Resta',
        description: 'Lección introductoria sobre operaciones aritméticas para niños de 6-8 años.',
        expectedDurationMinutes: 15,
        version: '1.0.0',
        published: true,
      },
    });

    // Crear atoms (uno por paso — solo para tener el FK requerido)
    const mathAtoms = {
      intro: await createAtom('math-intro', 'Bienvenida Matemáticas', 'MICROLECTURE'),
      addContent: await createAtom('math-add-content', 'Explicación Suma', 'MICROLECTURE'),
      addQuestion: await createAtom('math-add-question', 'Pregunta Suma', 'MINI_ACTIVITY'),
      addActivity: await createAtom('math-add-activity', 'Actividad Suma', 'MINI_QUIZ'),
      subContent: await createAtom('math-sub-content', 'Explicación Resta', 'MICROLECTURE'),
      subQuestion: await createAtom('math-sub-question', 'Pregunta Resta', 'MINI_ACTIVITY'),
      subActivity: await createAtom('math-sub-activity', 'Actividad Resta', 'MINI_QUIZ'),
      exam: await createAtom('math-exam', 'Examen Matemáticas', 'MINI_QUIZ'),
      closure: await createAtom('math-closure', 'Cierre Matemáticas', 'MICROLECTURE'),
    };

    const mathSteps = [
      // ── 0. Intro ────────────────────────────────────────────────────────
      {
        atomId: mathAtoms.intro,
        order: 0,
        stepType: 'intro',
        script: introScript(
          '¡Bienvenido a tu clase de matemáticas!',
          'Hoy vamos a aprender dos operaciones muy importantes: la suma y la resta. Con ellas podrás contar, repartir y resolver problemas de la vida real.',
          '¡Empecemos con la suma!',
        ),
      },

      // ── 1. Contenido: La Suma ───────────────────────────────────────────
      {
        atomId: mathAtoms.addContent,
        order: 1,
        stepType: 'content',
        script: contentScript(
          '¿Sabías que podemos juntar cosas?',
          'Sumar es juntar cantidades. Cuando tenemos dos grupos de cosas y los unimos, obtenemos el total. El signo de la suma es el más (+). Por ejemplo: 2 + 3 es "dos más tres".',
          [
            '2 + 1 = 3 (dos cuadernos más uno son tres)',
            '3 + 2 = 5 (tres fichas más dos son cinco)',
            '4 + 1 = 5 (cuatro velas más una son cinco)',
          ],
          '¡Ahora voy a hacerte una pregunta para ver si lo entendiste!',
        ),
      },

      // ── 2. Pregunta de comprensión: Suma ───────────────────────────────
      {
        atomId: mathAtoms.addQuestion,
        order: 2,
        stepType: 'question',
        script: questionScript(
          'Muy bien, escuchá la pregunta.',
          '¿Qué significa sumar? Explicalo con tus palabras.',
          'juntar cantidades o cosas para obtener el total',
          'Pista: piensa en cuando juntás tus juguetes con los de un amigo.',
          '¡Excelente! Sumar es exactamente eso: juntar cosas para saber cuántas hay en total.',
          'Casi. Sumar significa juntar cantidades. Si tenés 2 lápices y te dan 3 más, al sumarlos tenés 5 en total.',
        ),
      },

      // ── 3. Actividad MCQ: Suma ──────────────────────────────────────────
      {
        atomId: mathAtoms.addActivity,
        order: 3,
        stepType: 'activity',
        script: activityScript(
          '¡Ahora vamos a practicar con una actividad!',
          'Si tenés 2 manzanas y te dan 3 más, ¿cuántas manzanas tenés en total?',
          [
            { text: '5', isCorrect: true },
            { text: '3', isCorrect: false },
            { text: '6', isCorrect: false },
          ],
          '¡Correcto! 2 + 3 = 5. ¡Eres un campeón de la suma!',
          '¡Casi! Contá: tienes 2 y te dan 3 más. 1, 2... 3, 4, 5. ¡Son 5!',
          '¡Muy bien! Pasemos a la resta.',
        ),
      },

      // ── 4. Contenido: La Resta ──────────────────────────────────────────
      {
        atomId: mathAtoms.subContent,
        order: 4,
        stepType: 'content',
        script: contentScript(
          'Ahora aprenderemos algo nuevo.',
          'Restar es quitar cantidades. Cuando tenemos un grupo y sacamos algunos, nos queda la diferencia. El signo de la resta es el menos (-). Por ejemplo: 5 - 2 es "cinco menos dos".',
          [
            '5 - 1 = 4 (cinco globos, se escapa uno, quedan cuatro)',
            '4 - 2 = 2 (cuatro caramelos, me como dos, quedan dos)',
            '3 - 1 = 2 (tres monedas, gasto una, quedan dos)',
          ],
          'Veamos si entendiste.',
        ),
      },

      // ── 5. Pregunta de comprensión: Resta ──────────────────────────────
      {
        atomId: mathAtoms.subQuestion,
        order: 5,
        stepType: 'question',
        script: questionScript(
          'Prestá mucha atención a la pregunta.',
          '¿Qué signo usamos para restar y qué significa?',
          'el signo menos (-) significa quitar o sacar',
          'Pista: es el palito horizontal que separa números en una resta.',
          '¡Perfecto! El signo menos (-) indica que estamos quitando cantidades.',
          'El signo de la resta es el menos (-). Significa quitar o sacar algo de un total.',
        ),
      },

      // ── 6. Actividad MCQ: Resta ─────────────────────────────────────────
      {
        atomId: mathAtoms.subActivity,
        order: 6,
        stepType: 'activity',
        script: activityScript(
          '¡Es tu turno de restar!',
          'Si tenés 5 caramelos y te comés 2, ¿cuántos caramelos te quedan?',
          [
            { text: '3', isCorrect: true },
            { text: '2', isCorrect: false },
            { text: '4', isCorrect: false },
          ],
          '¡Muy bien! 5 - 2 = 3. ¡Sos experto en restas!',
          '¡Inténtalo de nuevo! Tenés 5 y quitás 2. Contá hacia atrás: 5... 4, 3. ¡Quedan 3!',
          '¡Genial! Ahora vamos al examen final.',
        ),
      },

      // ── 7. Examen final ─────────────────────────────────────────────────
      {
        atomId: mathAtoms.exam,
        order: 7,
        stepType: 'exam',
        script: examScript(
          '¡Llegó el momento del examen! Tranquilo, vos podés.',
          '¿Cuánto es 4 + 3?',
          [
            { text: '7', isCorrect: true },
            { text: '6', isCorrect: false },
            { text: '8', isCorrect: false },
          ],
          '¡Excelente! 4 + 3 = 7. ¡Aprobaste el examen!',
          'Casi. Contá desde 4: 5, 6, 7. La respuesta correcta es 7.',
        ),
      },

      // ── 8. Cierre ───────────────────────────────────────────────────────
      {
        atomId: mathAtoms.closure,
        order: 8,
        stepType: 'closure',
        script: introScript(
          '¡Llegamos al final de la clase!',
          '¡Felicitaciones! Hoy aprendiste que sumar es juntar cantidades usando el signo +, y que restar es quitar cantidades usando el signo -. ¡Estás listo para resolver muchos problemas!',
        ),
      },
    ];

    for (const step of mathSteps) {
      await prisma.recipeStep.create({
        data: {
          id: randomUUID(),
          recipeId: MATH_RECIPE_ID,
          atomId: step.atomId,
          order: step.order,
          stepType: step.stepType,
          script: step.script,
        },
      });
    }
    console.log(`✅ Math recipe: ${mathSteps.length} pasos auto-contenidos`);

    // ═════════════════════════════════════════════════════════════════════════
    // RECIPE 2: Figuras Geométricas
    //
    // Flujo:
    //   0. intro
    //   1. content (círculo)
    //   2. question (¿Cuántos lados tiene?)
    //   3. activity (MCQ: ¿cuál tiene forma de círculo?)
    //   4. content (cuadrado)
    //   5. question (¿Cuántas esquinas?)
    //   6. activity (MCQ: esquinas del cuadrado)
    //   7. content (triángulo)
    //   8. question (¿Cuántos lados?)
    //   9. activity (MCQ: forma de triángulo)
    //  10. exam (MCQ: identifica la figura)
    //  11. closure
    // ═════════════════════════════════════════════════════════════════════════

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

    const shapesAtoms = {
      intro: await createAtom('shapes-intro', 'Bienvenida Figuras', 'MICROLECTURE'),
      circleContent: await createAtom('shapes-circle-content', 'El Círculo', 'MICROLECTURE'),
      circleQuestion: await createAtom(
        'shapes-circle-question',
        'Pregunta Círculo',
        'MINI_ACTIVITY',
      ),
      circleActivity: await createAtom('shapes-circle-activity', 'Actividad Círculo', 'MINI_QUIZ'),
      squareContent: await createAtom('shapes-square-content', 'El Cuadrado', 'MICROLECTURE'),
      squareQuestion: await createAtom(
        'shapes-square-question',
        'Pregunta Cuadrado',
        'MINI_ACTIVITY',
      ),
      squareActivity: await createAtom('shapes-square-activity', 'Actividad Cuadrado', 'MINI_QUIZ'),
      triangleContent: await createAtom('shapes-triangle-content', 'El Triángulo', 'MICROLECTURE'),
      triangleQuestion: await createAtom(
        'shapes-triangle-question',
        'Pregunta Triángulo',
        'MINI_ACTIVITY',
      ),
      triangleActivity: await createAtom(
        'shapes-triangle-activity',
        'Actividad Triángulo',
        'MINI_QUIZ',
      ),
      exam: await createAtom('shapes-exam', 'Examen Figuras', 'MINI_QUIZ'),
      closure: await createAtom('shapes-closure', 'Cierre Figuras', 'MICROLECTURE'),
    };

    const shapesSteps = [
      // 0. Intro
      {
        atomId: shapesAtoms.intro,
        order: 0,
        stepType: 'intro',
        script: introScript(
          '¡Bienvenido a la clase de figuras!',
          'Hoy vamos a conocer tres figuras muy importantes: el círculo, el cuadrado y el triángulo. Las vas a encontrar en todas partes.',
          '¡Empecemos con el círculo!',
        ),
      },
      // 1. Círculo — contenido
      {
        atomId: shapesAtoms.circleContent,
        order: 1,
        stepType: 'content',
        script: contentScript(
          '¿Conocés esta figura redonda?',
          'El círculo es una figura especial: no tiene esquinas ni lados. Es perfectamente redondo. Podés encontrarlo en pelotas, monedas y el sol.',
          [
            'Una pelota es como un círculo',
            'El sol es como un círculo',
            'Una moneda es como un círculo',
          ],
          '¡Ahora te pregunto algo sobre el círculo!',
        ),
      },
      // 2. Círculo — pregunta de comprensión
      {
        atomId: shapesAtoms.circleQuestion,
        order: 2,
        stepType: 'question',
        script: questionScript(
          'Escuchá bien la pregunta.',
          '¿Cuántas esquinas tiene un círculo?',
          'cero, ninguna, no tiene esquinas',
          'Pista: pensá en una pelota. ¿Tiene puntas o esquinas?',
          '¡Correcto! El círculo no tiene ninguna esquina. Es completamente redondo.',
          'Un círculo no tiene esquinas. Es redondo por todos lados, sin ninguna punta.',
        ),
      },
      // 3. Círculo — actividad MCQ
      {
        atomId: shapesAtoms.circleActivity,
        order: 3,
        stepType: 'activity',
        script: activityScript(
          '¡Vamos a practicar!',
          '¿Cuál de estas cosas tiene forma de círculo?',
          [
            { text: 'Una pelota', isCorrect: true },
            { text: 'Una caja', isCorrect: false },
            { text: 'Un señal de tránsito triangular', isCorrect: false },
          ],
          '¡Correcto! La pelota es redonda como un círculo.',
          '¡Inténtalo de nuevo! El círculo es redondo, sin esquinas. ¿Cuál de esas opciones es redonda?',
          '¡Muy bien! Sigamos con el cuadrado.',
        ),
      },
      // 4. Cuadrado — contenido
      {
        atomId: shapesAtoms.squareContent,
        order: 4,
        stepType: 'content',
        script: contentScript(
          '¡Vamos a otra figura!',
          'El cuadrado tiene 4 lados y todos miden lo mismo. También tiene 4 esquinas. Parece una ventana o una baldosa.',
          [
            'Una ventana tiene forma de cuadrado',
            'Un dado tiene caras cuadradas',
            'Una baldosa del piso es un cuadrado',
          ],
          '¡Veamos si lo entendiste!',
        ),
      },
      // 5. Cuadrado — pregunta de comprensión
      {
        atomId: shapesAtoms.squareQuestion,
        order: 5,
        stepType: 'question',
        script: questionScript(
          'Prestá atención.',
          '¿Cuántas esquinas tiene un cuadrado?',
          'cuatro, 4',
          'Pista: mirá una ventana. Contá las esquinas.',
          '¡Perfecto! El cuadrado tiene exactamente 4 esquinas.',
          'Un cuadrado tiene 4 esquinas, una en cada vértice.',
        ),
      },
      // 6. Cuadrado — actividad MCQ
      {
        atomId: shapesAtoms.squareActivity,
        order: 6,
        stepType: 'activity',
        script: activityScript(
          '¡Es tu turno!',
          '¿Cuántas esquinas tiene un cuadrado?',
          [
            { text: '4', isCorrect: true },
            { text: '3', isCorrect: false },
            { text: '5', isCorrect: false },
          ],
          '¡Muy bien! El cuadrado tiene 4 esquinas.',
          '¡Pensalo de nuevo! Contá las esquinas de una ventana: arriba izquierda, arriba derecha, abajo derecha, abajo izquierda. ¡Son 4!',
          '¡Excelente! Ahora el triángulo.',
        ),
      },
      // 7. Triángulo — contenido
      {
        atomId: shapesAtoms.triangleContent,
        order: 7,
        stepType: 'content',
        script: contentScript(
          '¡Una figura más!',
          'El triángulo tiene 3 lados y 3 esquinas. Parece una rebanada de pizza o un sombrero de mago.',
          [
            'Una pizza triangular tiene 3 lados',
            'Un letrero de advertencia tiene forma de triángulo',
            'Un sombrero de mago es triangular',
          ],
          '¡Ahora vamos a ver si lo entendiste!',
        ),
      },
      // 8. Triángulo — pregunta de comprensión
      {
        atomId: shapesAtoms.triangleQuestion,
        order: 8,
        stepType: 'question',
        script: questionScript(
          'Última pregunta de comprensión.',
          '¿Cuántos lados tiene un triángulo?',
          'tres, 3',
          'Pista: la palabra "triángulo" viene de "tri" que significa tres.',
          '¡Excelente! El triángulo tiene exactamente 3 lados.',
          'El triángulo tiene 3 lados. La palabra "tri" en su nombre nos da la pista.',
        ),
      },
      // 9. Triángulo — actividad MCQ
      {
        atomId: shapesAtoms.triangleActivity,
        order: 9,
        stepType: 'activity',
        script: activityScript(
          '¡Último desafío antes del examen!',
          '¿Cuál de estas cosas tiene forma de triángulo?',
          [
            { text: 'Una rebanada de pizza', isCorrect: true },
            { text: 'Una moneda', isCorrect: false },
            { text: 'Una ventana cuadrada', isCorrect: false },
          ],
          '¡Exacto! La pizza tiene forma de triángulo con 3 lados.',
          '¡Inténtalo de nuevo! El triángulo tiene 3 esquinas y 3 lados. ¿Cuál de esas opciones tiene esa forma?',
          '¡Fantástico! Ahora el examen final.',
        ),
      },
      // 10. Examen final
      {
        atomId: shapesAtoms.exam,
        order: 10,
        stepType: 'exam',
        script: examScript(
          '¡Llegó el examen! ¡Vos podés!',
          'Una figura que tiene 4 lados iguales y 4 esquinas es un…',
          [
            { text: 'Cuadrado', isCorrect: true },
            { text: 'Círculo', isCorrect: false },
            { text: 'Triángulo', isCorrect: false },
          ],
          '¡Perfecto! El cuadrado tiene 4 lados iguales y 4 esquinas. ¡Aprobaste!',
          'La respuesta es el cuadrado: 4 lados iguales y 4 esquinas.',
        ),
      },
      // 11. Cierre
      {
        atomId: shapesAtoms.closure,
        order: 11,
        stepType: 'closure',
        script: introScript(
          '¡Terminamos la clase!',
          '¡Felicitaciones! Ahora conocés el círculo (sin esquinas), el cuadrado (4 lados iguales, 4 esquinas) y el triángulo (3 lados, 3 esquinas). ¡Buscalos en tu casa!',
        ),
      },
    ];

    for (const step of shapesSteps) {
      await prisma.recipeStep.create({
        data: {
          id: randomUUID(),
          recipeId: SHAPES_RECIPE_ID,
          atomId: step.atomId,
          order: step.order,
          stepType: step.stepType,
          script: step.script,
        },
      });
    }
    console.log(`✅ Shapes recipe: ${shapesSteps.length} pasos auto-contenidos`);

    // ── Sesión de prueba ────────────────────────────────────────────────────
    const sessionId = randomUUID();
    await prisma.session.create({
      data: {
        id: sessionId,
        studentId: TEST_STUDENT_ID,
        recipeId: MATH_RECIPE_ID,
        status: 'IDLE',
        stateCheckpoint: {
          currentState: 'AWAITING_START',
          currentStepIndex: 0,
          questionCount: 0,
          lastQuestionTime: null,
          skippedActivities: [],
          failedAttempts: 0,
        },
      },
    });

    await prisma.userProgress.create({
      data: {
        id: randomUUID(),
        userId: TEST_STUDENT_ID,
        recipeId: MATH_RECIPE_ID,
        status: 'IN_PROGRESS',
        attempts: 0,
      },
    });

    console.log('\n🎉 Seed completed!');
    console.log('─────────────────────────────────────────────');
    console.log('📋 Recetas creadas:');
    console.log(`  Math:   ${MATH_RECIPE_ID}  (${mathSteps.length} pasos)`);
    console.log(`  Shapes: ${SHAPES_RECIPE_ID}  (${shapesSteps.length} pasos)`);
    console.log('\n📋 Tipos de paso por receta (math):');
    console.log(
      '  intro → content → question → activity → content → question → activity → exam → closure',
    );
    console.log('\n👤 Credenciales:');
    console.log('  student@test.pixel-mentor / testpassword123');
    console.log('  teacher@test.pixel-mentor / testpassword123');
    console.log('\n💡 Cada RecipeStep es auto-contenido.');
    console.log('   El orquestador lee todo de script.options/script.question.');
    console.log('─────────────────────────────────────────────');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
