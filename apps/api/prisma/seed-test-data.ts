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

type AtomTypeValue =
  | 'MICROLECTURE'
  | 'DEMO'
  | 'MINI_ACTIVITY'
  | 'HINT'
  | 'MINI_QUIZ'
  | 'REMEDIAL'
  | 'INTERACTIVE'
  | 'MANIPULATIVE'
  | 'DRAGDROP'
  | 'MCQ';

type Option = {
  text: string;
  isCorrect: boolean;
  feedback?: string;
};

function makeChunks(...texts: string[]) {
  return texts.filter(Boolean).map((text, index) => ({
    text,
    pauseAfter: index === texts.length - 1 ? 0 : 1,
  }));
}

function introScript(transition: string, content: string, closure = '') {
  return {
    kind: 'intro',
    transition,
    content,
    examples: [],
    keyPoints: [],
    closure,
  };
}

function contentScript(
  transition: string,
  content: string,
  examples: string[],
  keyPoints: string[],
  closure: string,
) {
  return {
    kind: 'content',
    transition,
    content,
    examples,
    keyPoints,
    closure,
  };
}

function questionScript(
  transition: string,
  question: string,
  expectedAnswer: string,
  hint: string,
  feedbackCorrect: string,
  feedbackIncorrect: string,
) {
  return {
    kind: 'question',
    transition,
    question,
    expectedAnswer,
    hint,
    feedback: {
      correct: feedbackCorrect,
      incorrect: feedbackIncorrect,
    },
  };
}

function activityScript(
  transition: string,
  instruction: string,
  options: Option[],
  feedbackCorrect: string,
  feedbackIncorrect: string,
  closure = '',
) {
  const correctAnswer = options.find((option) => option.isCorrect)?.text ?? '';
  return {
    kind: 'activity',
    transition,
    instruction,
    options,
    correctAnswer,
    feedback: {
      correct: feedbackCorrect,
      incorrect: feedbackIncorrect,
      partial: 'Intentemos una vez más con calma.',
    },
    closure,
  };
}

function examScript(
  transition: string,
  instruction: string,
  options: Option[],
  feedbackCorrect: string,
  feedbackIncorrect: string,
) {
  const correctAnswer = options.find((option) => option.isCorrect)?.text ?? '';
  return {
    kind: 'exam',
    transition,
    instruction,
    options,
    correctAnswer,
    feedback: {
      correct: feedbackCorrect,
      incorrect: feedbackIncorrect,
      partial: 'Revisemos la idea anterior con atención.',
    },
  };
}

async function createAtom(params: {
  canonicalId: string;
  title: string;
  type: AtomTypeValue;
  description?: string;
  content?: any;
  ssmlChunks?: any;
  durationSeconds?: number;
  difficulty?: number;
  published?: boolean;
  options?: Option[];
}) {
  const id = randomUUID();

  await prisma.atom.create({
    data: {
      id,
      canonicalId: params.canonicalId,
      title: params.title,
      description: params.description,
      type: params.type as any,
      ssmlChunks: params.ssmlChunks,
      content: params.content,
      locale: 'es-AR',
      durationSeconds: params.durationSeconds,
      difficulty: params.difficulty ?? 1,
      version: '1.0.0',
      published: params.published ?? true,
    },
  });

  if (params.options?.length) {
    await prisma.atomOption.createMany({
      data: params.options.map((option, index) => ({
        id: randomUUID(),
        atomId: id,
        text: option.text,
        isCorrect: option.isCorrect,
        order: index + 1,
        feedback: option.feedback,
      })),
    });
  }

  return id;
}

async function createConcept(params: {
  recipeId: string;
  order: number;
  title: string;
  introduction: any;
  explanation: any;
  examples: any;
  keyPoints: any;
  closure: any;
}) {
  return prisma.concept.create({
    data: {
      id: randomUUID(),
      recipeId: params.recipeId,
      title: params.title,
      order: params.order,
      introduction: params.introduction,
      explanation: params.explanation,
      examples: params.examples,
      keyPoints: params.keyPoints,
      closure: params.closure,
    },
  });
}

async function createActivity(params: {
  conceptId: string;
  order: number;
  type: string;
  instruction: string;
  options: Option[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
  partialFeedback?: string;
}) {
  const correctAnswer = params.options.find((option) => option.isCorrect)?.text ?? '';

  return prisma.activity.create({
    data: {
      id: randomUUID(),
      conceptId: params.conceptId,
      type: params.type,
      order: params.order,
      instruction: params.instruction,
      options: params.options as any,
      correctAnswer,
      feedback: {
        correct: params.feedbackCorrect,
        incorrect: params.feedbackIncorrect,
        partial: params.partialFeedback ?? 'Intentemos otra vez con más calma.',
      },
    },
  });
}

function stepData(params: {
  recipeId: string;
  atomId: string;
  order: number;
  stepType: string;
  script: any;
  conceptId?: string;
  activityId?: string;
}) {
  return {
    id: randomUUID(),
    recipeId: params.recipeId,
    atomId: params.atomId,
    order: params.order,
    stepType: params.stepType,
    script: params.script,
    ...(params.conceptId ? { conceptId: params.conceptId } : {}),
    ...(params.activityId ? { activityId: params.activityId } : {}),
  };
}

async function main() {
  console.log('🌱 Starting database seed...');

  const TEST_STUDENT_ID = randomUUID();
  const TEST_TEACHER_ID = randomUUID();

  const studentPasswordHash = await argon2.hash('testpassword123', HASH_OPTIONS);
  const teacherPasswordHash = await argon2.hash('testpassword123', HASH_OPTIONS);

  try {
    await prisma.recipeStep.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.concept.deleteMany();
    await prisma.interaction.deleteMany();
    await prisma.teacherReviewTicket.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userProgress.deleteMany();
    await prisma.activityAttempt.deleteMany();
    await prisma.eventLog.deleteMany();
    await prisma.atomOption.deleteMany();
    await prisma.knowledgeChunk.deleteMany();
    await prisma.atomCompetency.deleteMany();
    await prisma.assetAttachment.deleteMany();
    await prisma.recipeTag.deleteMany();
    await prisma.atom.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.module.deleteMany();
    await prisma.level.deleteMany();
    await prisma.competencyMastery.deleteMany();
    await prisma.parentalConsent.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.competency.deleteMany();

    await prisma.$executeRaw`
      DELETE FROM "users"
      WHERE "email" IN ('student@test.pixel-mentor', 'teacher@test.pixel-mentor')
    `;

    console.log('🗑️ Cleared previous test data');

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

    await prisma.parentalConsent.create({
      data: {
        id: randomUUID(),
        studentId: TEST_STUDENT_ID,
        parentEmail: 'parent@test.pixel-mentor',
        status: 'APPROVED',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        consentedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'seed-script',
      },
    });

    const level = await prisma.level.create({
      data: {
        id: randomUUID(),
        slug: 'primaria-inicial',
        name: 'Primaria Inicial',
        minAge: 6,
        maxAge: 8,
      },
    });

    const mathModule = await prisma.module.create({
      data: {
        id: randomUUID(),
        slug: 'matematica-basica',
        name: 'Matemática Básica',
        levelId: level.id,
      },
    });

    const shapesModule = await prisma.module.create({
      data: {
        id: randomUUID(),
        slug: 'figuras-geometricas',
        name: 'Figuras Geométricas',
        levelId: level.id,
      },
    });

    const tags = {
      primaria: await prisma.tag.create({
        data: {
          id: randomUUID(),
          name: 'primaria',
        },
      }),
      matematicas: await prisma.tag.create({
        data: {
          id: randomUUID(),
          name: 'matematicas',
        },
      }),
      aritmetica: await prisma.tag.create({
        data: {
          id: randomUUID(),
          name: 'aritmetica',
        },
      }),
      geometria: await prisma.tag.create({
        data: {
          id: randomUUID(),
          name: 'geometria',
        },
      }),
      figuras: await prisma.tag.create({
        data: {
          id: randomUUID(),
          name: 'figuras',
        },
      }),
    };

    const competencies = {
      math: await prisma.competency.create({
        data: {
          id: randomUUID(),
          code: 'MATH_BASIC_ARITH_01',
          name: 'Suma y resta básicas',
          description: 'Identifica y resuelve sumas y restas simples.',
        },
      }),
      shapes: await prisma.competency.create({
        data: {
          id: randomUUID(),
          code: 'GEO_BASIC_SHAPES_01',
          name: 'Reconocimiento de figuras básicas',
          description: 'Reconoce círculo, cuadrado y triángulo en contextos cotidianos.',
        },
      }),
    };

    const mathRecipeId = randomUUID();

    await prisma.recipe.create({
      data: {
        id: mathRecipeId,
        canonicalId: 'math-basics-es-AR',
        title: 'Matemáticas Básicas: Suma y Resta',
        description:
          'Lección introductoria sobre operaciones aritméticas para niños de 6 a 8 años.',
        expectedDurationMinutes: 18,
        version: '2.0.0',
        published: true,
        moduleId: mathModule.id,
      },
    });

    const mathConcepts = {
      sum: await createConcept({
        recipeId: mathRecipeId,
        order: 1,
        title: 'La suma',
        introduction: {
          text: 'Ahora vamos a aprender qué significa sumar.',
          duration: 20,
        },
        explanation: {
          text: 'Sumar significa juntar cantidades para saber cuántas hay en total. Cuando unimos dos grupos, el resultado es la cantidad completa. El signo que usamos es el más, +.',
          chunks: [
            { text: 'Sumar significa juntar cantidades.', pauseAfter: 1 },
            { text: 'Cuando unimos dos grupos, obtenemos un total.', pauseAfter: 1 },
            { text: 'El signo de la suma es +.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: 'Si tengo 2 lápices y me regalan 1 más, ahora tengo 3 lápices.',
            visual: { type: 'none' },
          },
          {
            text: 'Si junto 3 fichas con 2 fichas más, tengo 5 fichas en total.',
            visual: { type: 'none' },
          },
          {
            text: 'Si tengo 4 caramelos y me dan 1 más, ahora tengo 5 caramelos.',
            visual: { type: 'none' },
          },
        ],
        keyPoints: ['Sumar es juntar', 'Usamos el signo +', 'El resultado se llama total'],
        closure: {
          text: 'Ahora vamos a comprobar si lo entendiste.',
        },
      }),
      subtract: await createConcept({
        recipeId: mathRecipeId,
        order: 2,
        title: 'La resta',
        introduction: {
          text: 'Ahora vamos a aprender qué significa restar.',
          duration: 20,
        },
        explanation: {
          text: 'Restar significa quitar o sacar una cantidad de otra. Cuando empezamos con algo y luego quitamos una parte, queremos saber cuánto queda. El signo de la resta es el menos, -.',
          chunks: [
            { text: 'Restar significa quitar cantidades.', pauseAfter: 1 },
            { text: 'Cuando sacamos una parte, queremos saber cuánto queda.', pauseAfter: 1 },
            { text: 'El signo de la resta es -.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: 'Si tengo 5 caramelos y me como 2, me quedan 3 caramelos.',
            visual: { type: 'none' },
          },
          {
            text: 'Si tengo 4 globos y se va 1, me quedan 3 globos.',
            visual: { type: 'none' },
          },
          {
            text: 'Si tengo 3 figuritas y regalo 1, me quedan 2 figuritas.',
            visual: { type: 'none' },
          },
        ],
        keyPoints: ['Restar es quitar', 'Usamos el signo -', 'El resultado se llama lo que queda'],
        closure: {
          text: 'Vamos a practicar la resta con una pregunta.',
        },
      }),
      review: await createConcept({
        recipeId: mathRecipeId,
        order: 3,
        title: 'Repaso final',
        introduction: {
          text: 'Hagamos un repaso rápido antes del examen.',
          duration: 15,
        },
        explanation: {
          text: 'Hoy aprendiste que sumar es juntar cantidades y restar es quitar cantidades. También viste que usamos los signos + y - para representarlas.',
          chunks: [
            { text: 'Sumar es juntar cantidades.', pauseAfter: 1 },
            { text: 'Restar es quitar cantidades.', pauseAfter: 1 },
            { text: 'Usamos + y - para escribirlas.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: '2 + 3 = 5',
            visual: { type: 'none' },
          },
          {
            text: '5 - 2 = 3',
            visual: { type: 'none' },
          },
        ],
        keyPoints: ['Suma = juntar', 'Resta = quitar', 'Hay que leer con atención cada signo'],
        closure: {
          text: 'Muy bien. Ahora sí, vamos al examen final.',
        },
      }),
    };

    const mathActivities = {
      sum: await createActivity({
        conceptId: mathConcepts.sum.id,
        order: 1,
        type: 'PRACTICE',
        instruction: 'Si tenés 2 manzanas y te dan 3 más, ¿cuántas manzanas tenés en total?',
        options: [
          {
            text: '5',
            isCorrect: true,
            feedback: 'Correcto. 2 más 3 es 5.',
          },
          {
            text: '4',
            isCorrect: false,
            feedback: 'No. Probemos sumando juntos otra vez.',
          },
          {
            text: '6',
            isCorrect: false,
            feedback: 'Todavía no. Contemos con calma.',
          },
        ],
        feedbackCorrect: '¡Muy bien! 2 + 3 = 5.',
        feedbackIncorrect: 'Casi. Sumemos los dos grupos otra vez.',
      }),
      subtract: await createActivity({
        conceptId: mathConcepts.subtract.id,
        order: 1,
        type: 'PRACTICE',
        instruction: 'Si tenés 5 caramelos y te comés 2, ¿cuántos caramelos te quedan?',
        options: [
          {
            text: '3',
            isCorrect: true,
            feedback: 'Correcto. 5 menos 2 es 3.',
          },
          {
            text: '2',
            isCorrect: false,
            feedback: 'No. Pensá en cuántos quedan después de sacar 2.',
          },
          {
            text: '4',
            isCorrect: false,
            feedback: 'Casi. Restemos paso a paso.',
          },
        ],
        feedbackCorrect: '¡Muy bien! 5 - 2 = 3.',
        feedbackIncorrect: 'Probemos de nuevo restando con calma.',
      }),
      exam: await createActivity({
        conceptId: mathConcepts.review.id,
        order: 1,
        type: 'QUIZ',
        instruction: '¿Cuál opción es correcta?',
        options: [
          {
            text: '4 + 3 = 7',
            isCorrect: true,
            feedback: 'Correcto. 4 más 3 es 7.',
          },
          {
            text: '5 - 2 = 4',
            isCorrect: false,
            feedback: 'No. 5 menos 2 es 3.',
          },
          {
            text: 'Sumar es quitar cantidades',
            isCorrect: false,
            feedback: 'No. Sumar es juntar cantidades.',
          },
        ],
        feedbackCorrect: '¡Excelente! Aprobaste el examen.',
        feedbackIncorrect: 'Casi. Repasemos lo aprendido y volvamos a intentar.',
      }),
    };

    const mathAtoms = {
      intro: await createAtom({
        canonicalId: 'math-intro-v2',
        title: 'Bienvenida Matemáticas',
        type: 'MICROLECTURE',
        description: 'Apertura de la clase de suma y resta.',
        content: introScript(
          '¡Hola! Me alegra mucho que estés acá.',
          'Hoy vamos a aprender dos operaciones muy importantes: la suma y la resta. Son herramientas que usamos para contar, repartir y resolver problemas simples de la vida diaria.',
          'Primero vamos a entender qué significa sumar. Después veremos qué significa restar. Y al final haremos una actividad y un examen cortito para ver cuánto aprendiste.',
        ),
        ssmlChunks: makeChunks(
          '¡Hola! Me alegra mucho que estés acá.',
          'Hoy vamos a aprender dos operaciones muy importantes: la suma y la resta.',
          'Son herramientas que usamos para contar, repartir y resolver problemas simples de la vida diaria.',
        ),
        durationSeconds: 24,
      }),
      sum: await createAtom({
        canonicalId: 'math-sum-content-v2',
        title: 'Explicación Suma',
        type: 'MICROLECTURE',
        description: 'Contenido principal sobre la suma.',
        content: contentScript(
          'Empecemos con la suma.',
          'Sumar significa juntar cantidades para saber cuántas hay en total. El signo que usamos es el más, +.',
          [
            'Si tengo 2 lápices y me regalan 1 más, ahora tengo 3 lápices.',
            'Si junto 3 fichas con 2 fichas más, tengo 5 fichas en total.',
            'Si tengo 4 caramelos y me dan 1 más, ahora tengo 5 caramelos.',
          ],
          ['Sumar es juntar', 'Usamos el signo +', 'El resultado se llama total'],
          'Ahora vamos a comprobar si lo entendiste.',
        ),
        ssmlChunks: makeChunks(
          'Empecemos con la suma.',
          'Sumar significa juntar cantidades para saber cuántas hay en total.',
          'El signo que usamos es el más, +.',
        ),
        durationSeconds: 55,
      }),
      sumQuestion: await createAtom({
        canonicalId: 'math-sum-question-v2',
        title: 'Pregunta Suma',
        type: 'INTERACTIVE',
        description: 'Pregunta de comprensión sobre suma.',
        content: questionScript(
          'Pensá un momento antes de responder.',
          '¿Qué significa sumar?',
          'Juntar cantidades para saber cuánto hay en total.',
          'Pista: pensá en unir dos grupos de cosas.',
          '¡Muy bien! Sumar es juntar cantidades para obtener un total.',
          'Casi. Sumar significa unir cantidades. Por ejemplo, 2 cosas más 3 cosas dan 5 cosas en total.',
        ),
        ssmlChunks: makeChunks(
          'Pensá un momento antes de responder.',
          '¿Qué significa sumar?',
          'Pista: pensá en unir dos grupos de cosas.',
        ),
        durationSeconds: 22,
      }),
      sumActivity: await createAtom({
        canonicalId: 'math-sum-activity-v2',
        title: 'Actividad Suma',
        type: 'MCQ',
        description: 'Actividad de opción múltiple sobre suma.',
        content: activityScript(
          'Ahora vamos a practicar.',
          'Si tenés 2 manzanas y te dan 3 más, ¿cuántas manzanas tenés en total?',
          [
            {
              text: '5',
              isCorrect: true,
              feedback: 'Correcto. 2 más 3 es 5.',
            },
            {
              text: '4',
              isCorrect: false,
              feedback: 'No. Probemos sumando juntos otra vez.',
            },
            {
              text: '6',
              isCorrect: false,
              feedback: 'Todavía no. Contemos con calma.',
            },
          ],
          '¡Muy bien! 2 + 3 = 5.',
          'Casi. Sumemos los dos grupos otra vez.',
          'Vamos a seguir con la resta.',
        ),
        ssmlChunks: makeChunks(
          'Ahora vamos a practicar.',
          'Si tenés 2 manzanas y te dan 3 más, ¿cuántas manzanas tenés en total?',
        ),
        durationSeconds: 25,
        options: [
          {
            text: '5',
            isCorrect: true,
            feedback: 'Correcto. 2 más 3 es 5.',
          },
          {
            text: '4',
            isCorrect: false,
            feedback: 'No. Probemos sumando juntos otra vez.',
          },
          {
            text: '6',
            isCorrect: false,
            feedback: 'Todavía no. Contemos con calma.',
          },
        ],
      }),
      subtract: await createAtom({
        canonicalId: 'math-subtract-content-v2',
        title: 'Explicación Resta',
        type: 'MICROLECTURE',
        description: 'Contenido principal sobre la resta.',
        content: contentScript(
          'Ahora aprendamos la resta.',
          'Restar significa quitar o sacar una cantidad de otra. El signo de la resta es el menos, -.',
          [
            'Si tengo 5 caramelos y me como 2, me quedan 3 caramelos.',
            'Si tengo 4 globos y se va 1, me quedan 3 globos.',
            'Si tengo 3 figuritas y regalo 1, me quedan 2 figuritas.',
          ],
          ['Restar es quitar', 'Usamos el signo -', 'El resultado es lo que queda'],
          'Vamos a practicar la resta con una pregunta.',
        ),
        ssmlChunks: makeChunks(
          'Ahora aprendamos la resta.',
          'Restar significa quitar o sacar una cantidad de otra.',
          'El signo de la resta es el menos, -.',
        ),
        durationSeconds: 55,
      }),
      subtractQuestion: await createAtom({
        canonicalId: 'math-subtract-question-v2',
        title: 'Pregunta Resta',
        type: 'INTERACTIVE',
        description: 'Pregunta de comprensión sobre resta.',
        content: questionScript(
          'Ahora te pregunto sobre la resta.',
          '¿Qué significa restar?',
          'Quitar o sacar una cantidad de otra.',
          'Pista: pensá en cuando te quedás con menos cosas después de sacar algunas.',
          '¡Exacto! Restar es quitar una cantidad de un total.',
          'Muy cerca. Restar significa sacar o quitar algo para saber cuánto queda.',
        ),
        ssmlChunks: makeChunks(
          'Ahora te pregunto sobre la resta.',
          '¿Qué significa restar?',
          'Pista: pensá en cuando te quedás con menos cosas después de sacar algunas.',
        ),
        durationSeconds: 20,
      }),
      subtractActivity: await createAtom({
        canonicalId: 'math-subtract-activity-v2',
        title: 'Actividad Resta',
        type: 'MCQ',
        description: 'Actividad de opción múltiple sobre resta.',
        content: activityScript(
          'Vamos a practicar la resta.',
          'Si tenés 5 caramelos y te comés 2, ¿cuántos caramelos te quedan?',
          [
            {
              text: '3',
              isCorrect: true,
              feedback: 'Correcto. 5 menos 2 es 3.',
            },
            {
              text: '2',
              isCorrect: false,
              feedback: 'No. Pensá en cuántos quedan después de sacar 2.',
            },
            {
              text: '4',
              isCorrect: false,
              feedback: 'Casi. Restemos paso a paso.',
            },
          ],
          '¡Muy bien! 5 - 2 = 3.',
          'Probemos de nuevo restando con calma.',
          'Muy bien. Ya casi terminamos.',
        ),
        ssmlChunks: makeChunks(
          'Vamos a practicar la resta.',
          'Si tenés 5 caramelos y te comés 2, ¿cuántos caramelos te quedan?',
        ),
        durationSeconds: 25,
        options: [
          {
            text: '3',
            isCorrect: true,
            feedback: 'Correcto. 5 menos 2 es 3.',
          },
          {
            text: '2',
            isCorrect: false,
            feedback: 'No. Pensá en cuántos quedan después de sacar 2.',
          },
          {
            text: '4',
            isCorrect: false,
            feedback: 'Casi. Restemos paso a paso.',
          },
        ],
      }),
      review: await createAtom({
        canonicalId: 'math-review-v2',
        title: 'Repaso Final Matemáticas',
        type: 'MICROLECTURE',
        description: 'Repaso antes del examen final.',
        content: contentScript(
          'Hagamos un repaso rápido antes del examen.',
          'Hoy aprendiste que sumar es juntar cantidades y restar es quitar cantidades. También viste que usamos los signos + y - para representarlas.',
          ['2 + 3 = 5', '5 - 2 = 3'],
          ['Suma = juntar', 'Resta = quitar', 'Hay que leer con atención cada signo'],
          'Muy bien. Ahora sí, vamos al examen final.',
        ),
        ssmlChunks: makeChunks(
          'Hagamos un repaso rápido antes del examen.',
          'Hoy aprendiste que sumar es juntar cantidades y restar es quitar cantidades.',
          'También viste que usamos los signos + y - para representarlas.',
        ),
        durationSeconds: 35,
      }),
      exam: await createAtom({
        canonicalId: 'math-exam-v2',
        title: 'Examen Matemáticas',
        type: 'MINI_QUIZ',
        description: 'Evaluación final de suma y resta.',
        content: examScript(
          'Llegó el momento del examen. Tranquilo, vos podés.',
          '¿Cuál opción es correcta?',
          [
            {
              text: '4 + 3 = 7',
              isCorrect: true,
              feedback: 'Correcto. 4 más 3 es 7.',
            },
            {
              text: '5 - 2 = 4',
              isCorrect: false,
              feedback: 'No. 5 menos 2 es 3.',
            },
            {
              text: 'Sumar es quitar cantidades',
              isCorrect: false,
              feedback: 'No. Sumar es juntar cantidades.',
            },
          ],
          '¡Excelente! Aprobaste el examen.',
          'Casi. Repasemos la idea anterior con atención.',
        ),
        ssmlChunks: makeChunks(
          'Llegó el momento del examen. Tranquilo, vos podés.',
          '¿Cuál opción es correcta?',
        ),
        durationSeconds: 25,
        options: [
          {
            text: '4 + 3 = 7',
            isCorrect: true,
            feedback: 'Correcto. 4 más 3 es 7.',
          },
          {
            text: '5 - 2 = 4',
            isCorrect: false,
            feedback: 'No. 5 menos 2 es 3.',
          },
          {
            text: 'Sumar es quitar cantidades',
            isCorrect: false,
            feedback: 'No. Sumar es juntar cantidades.',
          },
        ],
      }),
      closure: await createAtom({
        canonicalId: 'math-closure-v2',
        title: 'Cierre Matemáticas',
        type: 'MICROLECTURE',
        description: 'Cierre de la clase de matemáticas.',
        content: introScript(
          '¡Llegamos al final de la clase!',
          'Hoy aprendiste que sumar es juntar cantidades usando el signo +, y que restar es quitar cantidades usando el signo -. ¡Estás listo para resolver muchos problemas!',
        ),
        ssmlChunks: makeChunks(
          '¡Llegamos al final de la clase!',
          'Hoy aprendiste que sumar es juntar cantidades usando el signo +, y que restar es quitar cantidades usando el signo -.',
        ),
        durationSeconds: 20,
      }),
    };

    await prisma.recipeTag.create({
      data: {
        recipeId: mathRecipeId,
        tagId: tags.primaria.id,
      },
    });

    await prisma.recipeTag.create({
      data: {
        recipeId: mathRecipeId,
        tagId: tags.matematicas.id,
      },
    });

    await prisma.recipeTag.create({
      data: {
        recipeId: mathRecipeId,
        tagId: tags.aritmetica.id,
      },
    });

    await prisma.atomCompetency.createMany({
      data: [
        mathAtoms.intro,
        mathAtoms.sum,
        mathAtoms.sumQuestion,
        mathAtoms.sumActivity,
        mathAtoms.subtract,
        mathAtoms.subtractQuestion,
        mathAtoms.subtractActivity,
        mathAtoms.review,
        mathAtoms.exam,
        mathAtoms.closure,
      ].map((atomId) => ({
        id: randomUUID(),
        atomId,
        competencyId: competencies.math.id,
        weight: 1,
      })),
    });

    const mathSteps = [
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.intro,
        order: 0,
        stepType: 'intro',
        script: introScript(
          '¡Hola! Me alegra mucho que estés acá.',
          'Hoy vamos a aprender dos operaciones muy importantes: la suma y la resta. Son herramientas que usamos para contar, repartir y resolver problemas simples de la vida diaria.',
          'Primero vamos a entender qué significa sumar. Después veremos qué significa restar. Y al final haremos una actividad y un examen cortito para ver cuánto aprendiste.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.sum,
        conceptId: mathConcepts.sum.id,
        order: 1,
        stepType: 'content',
        script: contentScript(
          'Empecemos con la suma.',
          'Sumar significa juntar cantidades para saber cuántas hay en total. El signo que usamos es el más, +.',
          [
            'Si tengo 2 lápices y me regalan 1 más, ahora tengo 3 lápices.',
            'Si junto 3 fichas con 2 fichas más, tengo 5 fichas en total.',
            'Si tengo 4 caramelos y me dan 1 más, ahora tengo 5 caramelos.',
          ],
          ['Sumar es juntar', 'Usamos el signo +', 'El resultado se llama total'],
          'Ahora vamos a comprobar si lo entendiste.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.sumQuestion,
        conceptId: mathConcepts.sum.id,
        order: 2,
        stepType: 'question',
        script: questionScript(
          'Pensá un momento antes de responder.',
          '¿Qué significa sumar?',
          'Juntar cantidades para saber cuánto hay en total.',
          'Pista: pensá en unir dos grupos de cosas.',
          '¡Muy bien! Sumar es juntar cantidades para obtener un total.',
          'Casi. Sumar significa unir cantidades. Por ejemplo, 2 cosas más 3 cosas dan 5 cosas en total.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.sumActivity,
        conceptId: mathConcepts.sum.id,
        activityId: mathActivities.sum.id,
        order: 3,
        stepType: 'activity',
        script: activityScript(
          'Ahora vamos a practicar.',
          'Si tenés 2 manzanas y te dan 3 más, ¿cuántas manzanas tenés en total?',
          [
            {
              text: '5',
              isCorrect: true,
              feedback: 'Correcto. 2 más 3 es 5.',
            },
            {
              text: '4',
              isCorrect: false,
              feedback: 'No. Probemos sumando juntos otra vez.',
            },
            {
              text: '6',
              isCorrect: false,
              feedback: 'Todavía no. Contemos con calma.',
            },
          ],
          '¡Muy bien! 2 + 3 = 5.',
          'Casi. Sumemos los dos grupos otra vez.',
          'Vamos a seguir con la resta.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.subtract,
        conceptId: mathConcepts.subtract.id,
        order: 4,
        stepType: 'content',
        script: contentScript(
          'Ahora aprendamos la resta.',
          'Restar significa quitar o sacar una cantidad de otra. El signo de la resta es el menos, -.',
          [
            'Si tengo 5 caramelos y me como 2, me quedan 3 caramelos.',
            'Si tengo 4 globos y se va 1, me quedan 3 globos.',
            'Si tengo 3 figuritas y regalo 1, me quedan 2 figuritas.',
          ],
          ['Restar es quitar', 'Usamos el signo -', 'El resultado es lo que queda'],
          'Vamos a practicar la resta con una pregunta.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.subtractQuestion,
        conceptId: mathConcepts.subtract.id,
        order: 5,
        stepType: 'question',
        script: questionScript(
          'Ahora te pregunto sobre la resta.',
          '¿Qué significa restar?',
          'Quitar o sacar una cantidad de otra.',
          'Pista: pensá en cuando te quedás con menos cosas después de sacar algunas.',
          '¡Exacto! Restar es quitar una cantidad de un total.',
          'Muy cerca. Restar significa sacar o quitar algo para saber cuánto queda.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.subtractActivity,
        conceptId: mathConcepts.subtract.id,
        activityId: mathActivities.subtract.id,
        order: 6,
        stepType: 'activity',
        script: activityScript(
          'Vamos a practicar la resta.',
          'Si tenés 5 caramelos y te comés 2, ¿cuántos caramelos te quedan?',
          [
            {
              text: '3',
              isCorrect: true,
              feedback: 'Correcto. 5 menos 2 es 3.',
            },
            {
              text: '2',
              isCorrect: false,
              feedback: 'No. Pensá en cuántos quedan después de sacar 2.',
            },
            {
              text: '4',
              isCorrect: false,
              feedback: 'Casi. Restemos paso a paso.',
            },
          ],
          '¡Muy bien! 5 - 2 = 3.',
          'Probemos de nuevo restando con calma.',
          'Muy bien. Ya casi terminamos.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.review,
        conceptId: mathConcepts.review.id,
        order: 7,
        stepType: 'content',
        script: contentScript(
          'Hagamos un repaso rápido antes del examen.',
          'Hoy aprendiste que sumar es juntar cantidades y restar es quitar cantidades. También viste que usamos los signos + y - para representarlas.',
          ['2 + 3 = 5', '5 - 2 = 3'],
          ['Suma = juntar', 'Resta = quitar', 'Hay que leer con atención cada signo'],
          'Muy bien. Ahora sí, vamos al examen final.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.exam,
        conceptId: mathConcepts.review.id,
        activityId: mathActivities.exam.id,
        order: 8,
        stepType: 'exam',
        script: examScript(
          'Llegó el momento del examen. Tranquilo, vos podés.',
          '¿Cuál opción es correcta?',
          [
            {
              text: '4 + 3 = 7',
              isCorrect: true,
              feedback: 'Correcto. 4 más 3 es 7.',
            },
            {
              text: '5 - 2 = 4',
              isCorrect: false,
              feedback: 'No. 5 menos 2 es 3.',
            },
            {
              text: 'Sumar es quitar cantidades',
              isCorrect: false,
              feedback: 'No. Sumar es juntar cantidades.',
            },
          ],
          '¡Excelente! Aprobaste el examen.',
          'Casi. Repasemos la idea anterior con atención.',
        ),
      }),
      stepData({
        recipeId: mathRecipeId,
        atomId: mathAtoms.closure,
        order: 9,
        stepType: 'closure',
        script: introScript(
          '¡Llegamos al final de la clase!',
          'Hoy aprendiste que sumar es juntar cantidades usando el signo +, y que restar es quitar cantidades usando el signo -. ¡Estás listo para resolver muchos problemas!',
        ),
      }),
    ];

    await prisma.recipeStep.createMany({
      data: mathSteps,
    });

    const shapesRecipeId = randomUUID();

    await prisma.recipe.create({
      data: {
        id: shapesRecipeId,
        canonicalId: 'shapes-es-AR',
        title: 'Figuras Geométricas: Círculo, Cuadrado y Triángulo',
        description: 'Aprende a reconocer y nombrar las figuras básicas de la geometría.',
        expectedDurationMinutes: 20,
        version: '2.0.0',
        published: true,
        moduleId: shapesModule.id,
      },
    });

    const shapesConcepts = {
      circle: await createConcept({
        recipeId: shapesRecipeId,
        order: 1,
        title: 'El círculo',
        introduction: {
          text: 'Comencemos con una figura redonda muy conocida.',
          duration: 18,
        },
        explanation: {
          text: 'El círculo es una figura redonda. No tiene lados rectos ni esquinas. Es suave y continua por todos sus bordes.',
          chunks: [
            { text: 'El círculo es redondo.', pauseAfter: 1 },
            { text: 'No tiene lados rectos.', pauseAfter: 1 },
            { text: 'No tiene esquinas.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: 'Una pelota tiene forma de círculo.',
            visual: { type: 'none' },
          },
          {
            text: 'Una moneda también se parece a un círculo.',
            visual: { type: 'none' },
          },
          {
            text: 'El sol muchas veces se dibuja como un círculo.',
            visual: { type: 'none' },
          },
        ],
        keyPoints: ['Es redondo', 'No tiene esquinas', 'No tiene lados rectos'],
        closure: {
          text: 'Ahora te haré una pregunta sobre el círculo.',
        },
      }),
      square: await createConcept({
        recipeId: shapesRecipeId,
        order: 2,
        title: 'El cuadrado',
        introduction: {
          text: 'Ahora vamos a conocer otra figura muy importante.',
          duration: 18,
        },
        explanation: {
          text: 'El cuadrado tiene 4 lados iguales y 4 esquinas. Todas sus partes son del mismo tamaño. Es una figura muy ordenada y fácil de reconocer.',
          chunks: [
            { text: 'El cuadrado tiene 4 lados iguales.', pauseAfter: 1 },
            { text: 'También tiene 4 esquinas.', pauseAfter: 1 },
            { text: 'Todas sus partes son del mismo tamaño.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: 'Una ventana puede tener forma de cuadrado.',
            visual: { type: 'none' },
          },
          {
            text: 'Una baldosa también puede ser cuadrada.',
            visual: { type: 'none' },
          },
          {
            text: 'Algunos dibujos de bloques o casillas son cuadrados.',
            visual: { type: 'none' },
          },
        ],
        keyPoints: ['Tiene 4 lados iguales', 'Tiene 4 esquinas', 'Es una figura muy ordenada'],
        closure: {
          text: 'Veamos si recordaste bien esta figura.',
        },
      }),
      triangle: await createConcept({
        recipeId: shapesRecipeId,
        order: 3,
        title: 'El triángulo',
        introduction: {
          text: 'Ahora vamos con una figura con forma puntiaguda.',
          duration: 18,
        },
        explanation: {
          text: 'El triángulo tiene 3 lados y 3 esquinas. Su nombre ya nos da una pista, porque “tri” significa tres.',
          chunks: [
            { text: 'El triángulo tiene 3 lados.', pauseAfter: 1 },
            { text: 'También tiene 3 esquinas.', pauseAfter: 1 },
            { text: '“Tri” significa tres.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: 'Una rebanada de pizza puede tener forma de triángulo.',
            visual: { type: 'none' },
          },
          {
            text: 'Un letrero de advertencia a veces es triangular.',
            visual: { type: 'none' },
          },
          {
            text: 'Un sombrero de mago puede parecer un triángulo.',
            visual: { type: 'none' },
          },
        ],
        keyPoints: ['Tiene 3 lados', 'Tiene 3 esquinas', '“Tri” significa tres'],
        closure: {
          text: 'Ahora vamos a practicar con una pregunta.',
        },
      }),
      review: await createConcept({
        recipeId: shapesRecipeId,
        order: 4,
        title: 'Repaso final',
        introduction: {
          text: 'Hagamos un repaso rápido antes del examen.',
          duration: 15,
        },
        explanation: {
          text: 'El círculo no tiene esquinas. El cuadrado tiene 4 lados iguales y 4 esquinas. El triángulo tiene 3 lados y 3 esquinas.',
          chunks: [
            { text: 'El círculo no tiene esquinas.', pauseAfter: 1 },
            { text: 'El cuadrado tiene 4 lados iguales y 4 esquinas.', pauseAfter: 1 },
            { text: 'El triángulo tiene 3 lados y 3 esquinas.', pauseAfter: 0 },
          ],
        },
        examples: [
          {
            text: 'Una pelota puede parecer un círculo.',
            visual: { type: 'none' },
          },
          {
            text: 'Una ventana puede parecer un cuadrado.',
            visual: { type: 'none' },
          },
          {
            text: 'Una pizza puede parecer un triángulo.',
            visual: { type: 'none' },
          },
        ],
        keyPoints: [
          'Círculo = redondo',
          'Cuadrado = 4 lados y 4 esquinas',
          'Triángulo = 3 lados y 3 esquinas',
        ],
        closure: {
          text: 'Muy bien. Ahora sí, vamos al examen final.',
        },
      }),
    };

    const shapesActivities = {
      circle: await createActivity({
        conceptId: shapesConcepts.circle.id,
        order: 1,
        type: 'PRACTICE',
        instruction: '¿Cuál de estas cosas tiene forma de círculo?',
        options: [
          {
            text: 'Una pelota',
            isCorrect: true,
            feedback: 'Correcto. La pelota es redonda como un círculo.',
          },
          {
            text: 'Una caja',
            isCorrect: false,
            feedback: 'No. La caja tiene bordes y caras rectas.',
          },
          {
            text: 'Un triángulo',
            isCorrect: false,
            feedback: 'No. El triángulo tiene lados rectos y esquinas.',
          },
        ],
        feedbackCorrect: '¡Correcto! La pelota es redonda como un círculo.',
        feedbackIncorrect: 'La pista es que el círculo es redondo y no tiene esquinas.',
      }),
      square: await createActivity({
        conceptId: shapesConcepts.square.id,
        order: 1,
        type: 'PRACTICE',
        instruction: '¿Cuántas esquinas tiene un cuadrado?',
        options: [
          {
            text: '4',
            isCorrect: true,
            feedback: 'Correcto. El cuadrado tiene 4 esquinas.',
          },
          {
            text: '3',
            isCorrect: false,
            feedback: 'No. El triángulo tiene 3 esquinas, no el cuadrado.',
          },
          {
            text: '5',
            isCorrect: false,
            feedback: 'No. El cuadrado no tiene 5 esquinas.',
          },
        ],
        feedbackCorrect: '¡Muy bien! El cuadrado tiene 4 esquinas.',
        feedbackIncorrect: 'Pensá en una ventana cuadrada y contá sus esquinas.',
      }),
      triangle: await createActivity({
        conceptId: shapesConcepts.triangle.id,
        order: 1,
        type: 'PRACTICE',
        instruction: '¿Cuál de estas cosas tiene forma de triángulo?',
        options: [
          {
            text: 'Una rebanada de pizza',
            isCorrect: true,
            feedback: 'Correcto. La pizza puede tener forma de triángulo.',
          },
          {
            text: 'Una moneda',
            isCorrect: false,
            feedback: 'No. La moneda se parece más a un círculo.',
          },
          {
            text: 'Una ventana cuadrada',
            isCorrect: false,
            feedback: 'No. La ventana cuadrada tiene forma de cuadrado.',
          },
        ],
        feedbackCorrect: '¡Muy bien! La rebanada de pizza puede tener forma de triángulo.',
        feedbackIncorrect: 'Recordá que el triángulo tiene 3 lados y 3 esquinas.',
      }),
      exam: await createActivity({
        conceptId: shapesConcepts.review.id,
        order: 1,
        type: 'QUIZ',
        instruction: '¿Cuál opción es correcta?',
        options: [
          {
            text: 'El círculo no tiene esquinas',
            isCorrect: true,
            feedback: 'Correcto. El círculo no tiene esquinas.',
          },
          {
            text: 'El cuadrado tiene 3 lados',
            isCorrect: false,
            feedback: 'No. El cuadrado tiene 4 lados iguales.',
          },
          {
            text: 'El triángulo tiene 4 esquinas',
            isCorrect: false,
            feedback: 'No. El triángulo tiene 3 esquinas.',
          },
        ],
        feedbackCorrect: '¡Excelente! Aprobaste el examen.',
        feedbackIncorrect: 'Casi. Repasemos las formas una vez más.',
      }),
    };

    const shapesAtoms = {
      intro: await createAtom({
        canonicalId: 'shapes-intro-v2',
        title: 'Bienvenida Figuras',
        type: 'MICROLECTURE',
        description: 'Apertura de la clase de figuras geométricas.',
        content: introScript(
          '¡Hola! Hoy vamos a aprender figuras geométricas muy conocidas.',
          'Vamos a estudiar el círculo, el cuadrado y el triángulo. Son figuras que vemos en objetos de todos los días, como pelotas, ventanas, carteles y pizzas.',
          'Primero vamos a conocer cada figura, después haremos preguntas y actividades, y al final tendrás un pequeño examen.',
        ),
        ssmlChunks: makeChunks(
          '¡Hola! Hoy vamos a aprender figuras geométricas muy conocidas.',
          'Vamos a estudiar el círculo, el cuadrado y el triángulo.',
          'Son figuras que vemos en objetos de todos los días.',
        ),
        durationSeconds: 24,
      }),
      circle: await createAtom({
        canonicalId: 'shapes-circle-content-v2',
        title: 'El Círculo',
        type: 'MICROLECTURE',
        description: 'Explicación del círculo.',
        content: contentScript(
          'Comencemos con el círculo.',
          'El círculo es una figura redonda. No tiene lados rectos ni esquinas. Es suave y continua por todos sus bordes.',
          [
            'Una pelota tiene forma de círculo.',
            'Una moneda también se parece a un círculo.',
            'El sol muchas veces se dibuja como un círculo.',
          ],
          ['Es redondo', 'No tiene esquinas', 'No tiene lados rectos'],
          'Ahora te haré una pregunta sobre el círculo.',
        ),
        ssmlChunks: makeChunks(
          'Comencemos con el círculo.',
          'El círculo es una figura redonda.',
          'No tiene lados rectos ni esquinas.',
        ),
        durationSeconds: 50,
      }),
      circleQuestion: await createAtom({
        canonicalId: 'shapes-circle-question-v2',
        title: 'Pregunta Círculo',
        type: 'INTERACTIVE',
        description: 'Pregunta de comprensión sobre círculo.',
        content: questionScript(
          'Escuchá bien la pregunta.',
          '¿Cuántas esquinas tiene un círculo?',
          'Ninguna. Tiene cero esquinas.',
          'Pista: pensá en una pelota. ¿Tiene puntas o esquinas?',
          '¡Correcto! El círculo no tiene ninguna esquina. Es completamente redondo.',
          'Muy bien. El círculo no tiene esquinas. Es redondo por todos lados.',
        ),
        ssmlChunks: makeChunks(
          'Escuchá bien la pregunta.',
          '¿Cuántas esquinas tiene un círculo?',
          'Pista: pensá en una pelota. ¿Tiene puntas o esquinas?',
        ),
        durationSeconds: 20,
      }),
      circleActivity: await createAtom({
        canonicalId: 'shapes-circle-activity-v2',
        title: 'Actividad Círculo',
        type: 'MCQ',
        description: 'Actividad de opción múltiple sobre círculo.',
        content: activityScript(
          'Vamos a practicar.',
          '¿Cuál de estas cosas tiene forma de círculo?',
          [
            {
              text: 'Una pelota',
              isCorrect: true,
              feedback: 'Correcto. La pelota es redonda como un círculo.',
            },
            {
              text: 'Una caja',
              isCorrect: false,
              feedback: 'No. La caja tiene bordes y caras rectas.',
            },
            {
              text: 'Un triángulo',
              isCorrect: false,
              feedback: 'No. El triángulo tiene lados rectos y esquinas.',
            },
          ],
          '¡Correcto! La pelota es redonda como un círculo.',
          'La pista es que el círculo es redondo y no tiene esquinas.',
          'Sigamos con el cuadrado.',
        ),
        ssmlChunks: makeChunks(
          'Vamos a practicar.',
          '¿Cuál de estas cosas tiene forma de círculo?',
        ),
        durationSeconds: 25,
        options: [
          {
            text: 'Una pelota',
            isCorrect: true,
            feedback: 'Correcto. La pelota es redonda como un círculo.',
          },
          {
            text: 'Una caja',
            isCorrect: false,
            feedback: 'No. La caja tiene bordes y caras rectas.',
          },
          {
            text: 'Un triángulo',
            isCorrect: false,
            feedback: 'No. El triángulo tiene lados rectos y esquinas.',
          },
        ],
      }),
      square: await createAtom({
        canonicalId: 'shapes-square-content-v2',
        title: 'El Cuadrado',
        type: 'MICROLECTURE',
        description: 'Explicación del cuadrado.',
        content: contentScript(
          'Ahora vamos con el cuadrado.',
          'El cuadrado tiene 4 lados iguales y 4 esquinas. Todas sus partes son del mismo tamaño. Es una figura muy ordenada y fácil de reconocer.',
          [
            'Una ventana puede tener forma de cuadrado.',
            'Una baldosa también puede ser cuadrada.',
            'Algunos dibujos de bloques o casillas son cuadrados.',
          ],
          ['Tiene 4 lados iguales', 'Tiene 4 esquinas', 'Es una figura muy ordenada'],
          'Veamos si recordaste bien esta figura.',
        ),
        ssmlChunks: makeChunks(
          'Ahora vamos con el cuadrado.',
          'El cuadrado tiene 4 lados iguales y 4 esquinas.',
          'Todas sus partes son del mismo tamaño.',
        ),
        durationSeconds: 50,
      }),
      squareQuestion: await createAtom({
        canonicalId: 'shapes-square-question-v2',
        title: 'Pregunta Cuadrado',
        type: 'INTERACTIVE',
        description: 'Pregunta de comprensión sobre cuadrado.',
        content: questionScript(
          'Ahora una pregunta sobre el cuadrado.',
          '¿Cuántas esquinas tiene un cuadrado?',
          'Cuatro. Tiene 4 esquinas.',
          'Pista: mirá una ventana. Contá las esquinas.',
          '¡Perfecto! El cuadrado tiene exactamente 4 esquinas.',
          'Un cuadrado tiene 4 esquinas, una en cada vértice.',
        ),
        ssmlChunks: makeChunks(
          'Ahora una pregunta sobre el cuadrado.',
          '¿Cuántas esquinas tiene un cuadrado?',
          'Pista: mirá una ventana. Contá las esquinas.',
        ),
        durationSeconds: 20,
      }),
      squareActivity: await createAtom({
        canonicalId: 'shapes-square-activity-v2',
        title: 'Actividad Cuadrado',
        type: 'MCQ',
        description: 'Actividad de opción múltiple sobre cuadrado.',
        content: activityScript(
          'Vamos a practicar el cuadrado.',
          '¿Cuántas esquinas tiene un cuadrado?',
          [
            {
              text: '4',
              isCorrect: true,
              feedback: 'Correcto. El cuadrado tiene 4 esquinas.',
            },
            {
              text: '3',
              isCorrect: false,
              feedback: 'No. El triángulo tiene 3 esquinas, no el cuadrado.',
            },
            {
              text: '5',
              isCorrect: false,
              feedback: 'No. El cuadrado no tiene 5 esquinas.',
            },
          ],
          '¡Muy bien! El cuadrado tiene 4 esquinas.',
          'Pensá en una ventana cuadrada y contá sus esquinas.',
          'Ahora pasemos al triángulo.',
        ),
        ssmlChunks: makeChunks(
          'Vamos a practicar el cuadrado.',
          '¿Cuántas esquinas tiene un cuadrado?',
        ),
        durationSeconds: 25,
        options: [
          {
            text: '4',
            isCorrect: true,
            feedback: 'Correcto. El cuadrado tiene 4 esquinas.',
          },
          {
            text: '3',
            isCorrect: false,
            feedback: 'No. El triángulo tiene 3 esquinas, no el cuadrado.',
          },
          {
            text: '5',
            isCorrect: false,
            feedback: 'No. El cuadrado no tiene 5 esquinas.',
          },
        ],
      }),
      triangle: await createAtom({
        canonicalId: 'shapes-triangle-content-v2',
        title: 'El Triángulo',
        type: 'MICROLECTURE',
        description: 'Explicación del triángulo.',
        content: contentScript(
          'Llegó el turno del triángulo.',
          'El triángulo tiene 3 lados y 3 esquinas. Su nombre ya nos da una pista, porque “tri” significa tres.',
          [
            'Una rebanada de pizza puede tener forma de triángulo.',
            'Un letrero de advertencia a veces es triangular.',
            'Un sombrero de mago puede parecer un triángulo.',
          ],
          ['Tiene 3 lados', 'Tiene 3 esquinas', '“Tri” significa tres'],
          'Ahora vamos a practicar con una pregunta.',
        ),
        ssmlChunks: makeChunks(
          'Llegó el turno del triángulo.',
          'El triángulo tiene 3 lados y 3 esquinas.',
          '“Tri” significa tres.',
        ),
        durationSeconds: 50,
      }),
      triangleQuestion: await createAtom({
        canonicalId: 'shapes-triangle-question-v2',
        title: 'Pregunta Triángulo',
        type: 'INTERACTIVE',
        description: 'Pregunta de comprensión sobre triángulo.',
        content: questionScript(
          'Escuchá esta pregunta.',
          '¿Cuántos lados tiene un triángulo?',
          'Tres. Tiene 3 lados.',
          'Pista: el nombre de la figura ya te ayuda.',
          '¡Excelente! El triángulo tiene 3 lados.',
          'Muy bien. “Tri” nos indica que son tres.',
        ),
        ssmlChunks: makeChunks(
          'Escuchá esta pregunta.',
          '¿Cuántos lados tiene un triángulo?',
          'Pista: el nombre de la figura ya te ayuda.',
        ),
        durationSeconds: 20,
      }),
      triangleActivity: await createAtom({
        canonicalId: 'shapes-triangle-activity-v2',
        title: 'Actividad Triángulo',
        type: 'MCQ',
        description: 'Actividad de opción múltiple sobre triángulo.',
        content: activityScript(
          'Última práctica antes del examen.',
          '¿Cuál de estas cosas tiene forma de triángulo?',
          [
            {
              text: 'Una rebanada de pizza',
              isCorrect: true,
              feedback: 'Correcto. La pizza puede tener forma de triángulo.',
            },
            {
              text: 'Una moneda',
              isCorrect: false,
              feedback: 'No. La moneda se parece más a un círculo.',
            },
            {
              text: 'Una ventana cuadrada',
              isCorrect: false,
              feedback: 'No. La ventana cuadrada tiene forma de cuadrado.',
            },
          ],
          '¡Muy bien! La rebanada de pizza puede tener forma de triángulo.',
          'Recordá que el triángulo tiene 3 lados y 3 esquinas.',
          'Ya casi terminamos. Vamos al repaso.',
        ),
        ssmlChunks: makeChunks(
          'Última práctica antes del examen.',
          '¿Cuál de estas cosas tiene forma de triángulo?',
        ),
        durationSeconds: 25,
        options: [
          {
            text: 'Una rebanada de pizza',
            isCorrect: true,
            feedback: 'Correcto. La pizza puede tener forma de triángulo.',
          },
          {
            text: 'Una moneda',
            isCorrect: false,
            feedback: 'No. La moneda se parece más a un círculo.',
          },
          {
            text: 'Una ventana cuadrada',
            isCorrect: false,
            feedback: 'No. La ventana cuadrada tiene forma de cuadrado.',
          },
        ],
      }),
      review: await createAtom({
        canonicalId: 'shapes-review-v2',
        title: 'Repaso Final Figuras',
        type: 'MICROLECTURE',
        description: 'Repaso antes del examen final de figuras.',
        content: contentScript(
          'Hagamos un repaso rápido antes del examen.',
          'El círculo no tiene esquinas. El cuadrado tiene 4 lados iguales y 4 esquinas. El triángulo tiene 3 lados y 3 esquinas.',
          [
            'Una pelota puede parecer un círculo.',
            'Una ventana puede parecer un cuadrado.',
            'Una pizza puede parecer un triángulo.',
          ],
          [
            'Círculo = redondo',
            'Cuadrado = 4 lados y 4 esquinas',
            'Triángulo = 3 lados y 3 esquinas',
          ],
          'Muy bien. Ahora sí, vamos al examen final.',
        ),
        ssmlChunks: makeChunks(
          'Hagamos un repaso rápido antes del examen.',
          'El círculo no tiene esquinas.',
          'El cuadrado tiene 4 lados iguales y 4 esquinas.',
          'El triángulo tiene 3 lados y 3 esquinas.',
        ),
        durationSeconds: 35,
      }),
      exam: await createAtom({
        canonicalId: 'shapes-exam-v2',
        title: 'Examen Figuras',
        type: 'MINI_QUIZ',
        description: 'Evaluación final de figuras geométricas.',
        content: examScript(
          'Llegó el examen. ¡Vos podés!',
          '¿Cuál opción es correcta?',
          [
            {
              text: 'El círculo no tiene esquinas',
              isCorrect: true,
              feedback: 'Correcto. El círculo no tiene esquinas.',
            },
            {
              text: 'El cuadrado tiene 3 lados',
              isCorrect: false,
              feedback: 'No. El cuadrado tiene 4 lados iguales.',
            },
            {
              text: 'El triángulo tiene 4 esquinas',
              isCorrect: false,
              feedback: 'No. El triángulo tiene 3 esquinas.',
            },
          ],
          '¡Excelente! Aprobaste el examen.',
          'Casi. Repasemos las formas una vez más.',
        ),
        ssmlChunks: makeChunks('Llegó el examen. ¡Vos podés!', '¿Cuál opción es correcta?'),
        durationSeconds: 25,
        options: [
          {
            text: 'El círculo no tiene esquinas',
            isCorrect: true,
            feedback: 'Correcto. El círculo no tiene esquinas.',
          },
          {
            text: 'El cuadrado tiene 3 lados',
            isCorrect: false,
            feedback: 'No. El cuadrado tiene 4 lados iguales.',
          },
          {
            text: 'El triángulo tiene 4 esquinas',
            isCorrect: false,
            feedback: 'No. El triángulo tiene 3 esquinas.',
          },
        ],
      }),
      closure: await createAtom({
        canonicalId: 'shapes-closure-v2',
        title: 'Cierre Figuras',
        type: 'MICROLECTURE',
        description: 'Cierre de la clase de figuras geométricas.',
        content: introScript(
          '¡Terminaste la clase!',
          'Hoy aprendiste tres figuras importantes: el círculo, que no tiene esquinas; el cuadrado, que tiene 4 lados iguales y 4 esquinas; y el triángulo, que tiene 3 lados y 3 esquinas. ¡Buscalos en tu casa!',
        ),
        ssmlChunks: makeChunks(
          '¡Terminaste la clase!',
          'Hoy aprendiste tres figuras importantes: el círculo, que no tiene esquinas; el cuadrado, que tiene 4 lados iguales y 4 esquinas; y el triángulo, que tiene 3 lados y 3 esquinas.',
        ),
        durationSeconds: 20,
      }),
    };

    await prisma.recipeTag.create({
      data: {
        recipeId: shapesRecipeId,
        tagId: tags.primaria.id,
      },
    });

    await prisma.recipeTag.create({
      data: {
        recipeId: shapesRecipeId,
        tagId: tags.geometria.id,
      },
    });

    await prisma.recipeTag.create({
      data: {
        recipeId: shapesRecipeId,
        tagId: tags.figuras.id,
      },
    });

    await prisma.atomCompetency.createMany({
      data: [
        shapesAtoms.intro,
        shapesAtoms.circle,
        shapesAtoms.circleQuestion,
        shapesAtoms.circleActivity,
        shapesAtoms.square,
        shapesAtoms.squareQuestion,
        shapesAtoms.squareActivity,
        shapesAtoms.triangle,
        shapesAtoms.triangleQuestion,
        shapesAtoms.triangleActivity,
        shapesAtoms.review,
        shapesAtoms.exam,
        shapesAtoms.closure,
      ].map((atomId) => ({
        id: randomUUID(),
        atomId,
        competencyId: competencies.shapes.id,
        weight: 1,
      })),
    });

    const shapesSteps = [
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.intro,
        order: 0,
        stepType: 'intro',
        script: introScript(
          '¡Hola! Hoy vamos a aprender figuras geométricas muy conocidas.',
          'Vamos a estudiar el círculo, el cuadrado y el triángulo. Son figuras que vemos en objetos de todos los días, como pelotas, ventanas, carteles y pizzas.',
          'Primero vamos a conocer cada figura, después haremos preguntas y actividades, y al final tendrás un pequeño examen.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.circle,
        conceptId: shapesConcepts.circle.id,
        order: 1,
        stepType: 'content',
        script: contentScript(
          'Comencemos con el círculo.',
          'El círculo es una figura redonda. No tiene lados rectos ni esquinas. Es suave y continua por todos sus bordes.',
          [
            'Una pelota tiene forma de círculo.',
            'Una moneda también se parece a un círculo.',
            'El sol muchas veces se dibuja como un círculo.',
          ],
          ['Es redondo', 'No tiene esquinas', 'No tiene lados rectos'],
          'Ahora te haré una pregunta sobre el círculo.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.circleQuestion,
        conceptId: shapesConcepts.circle.id,
        order: 2,
        stepType: 'question',
        script: questionScript(
          'Escuchá bien la pregunta.',
          '¿Cuántas esquinas tiene un círculo?',
          'Ninguna. Tiene cero esquinas.',
          'Pista: pensá en una pelota. ¿Tiene puntas o esquinas?',
          '¡Correcto! El círculo no tiene ninguna esquina. Es completamente redondo.',
          'Muy bien. El círculo no tiene esquinas. Es redondo por todos lados.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.circleActivity,
        conceptId: shapesConcepts.circle.id,
        activityId: shapesActivities.circle.id,
        order: 3,
        stepType: 'activity',
        script: activityScript(
          'Vamos a practicar.',
          '¿Cuál de estas cosas tiene forma de círculo?',
          [
            {
              text: 'Una pelota',
              isCorrect: true,
              feedback: 'Correcto. La pelota es redonda como un círculo.',
            },
            {
              text: 'Una caja',
              isCorrect: false,
              feedback: 'No. La caja tiene bordes y caras rectas.',
            },
            {
              text: 'Un triángulo',
              isCorrect: false,
              feedback: 'No. El triángulo tiene lados rectos y esquinas.',
            },
          ],
          '¡Correcto! La pelota es redonda como un círculo.',
          'La pista es que el círculo es redondo y no tiene esquinas.',
          'Sigamos con el cuadrado.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.square,
        conceptId: shapesConcepts.square.id,
        order: 4,
        stepType: 'content',
        script: contentScript(
          'Ahora vamos con el cuadrado.',
          'El cuadrado tiene 4 lados iguales y 4 esquinas. Todas sus partes son del mismo tamaño. Es una figura muy ordenada y fácil de reconocer.',
          [
            'Una ventana puede tener forma de cuadrado.',
            'Una baldosa también puede ser cuadrada.',
            'Algunos dibujos de bloques o casillas son cuadrados.',
          ],
          ['Tiene 4 lados iguales', 'Tiene 4 esquinas', 'Es una figura muy ordenada'],
          'Veamos si recordaste bien esta figura.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.squareQuestion,
        conceptId: shapesConcepts.square.id,
        order: 5,
        stepType: 'question',
        script: questionScript(
          'Ahora una pregunta sobre el cuadrado.',
          '¿Cuántas esquinas tiene un cuadrado?',
          'Cuatro. Tiene 4 esquinas.',
          'Pista: mirá una ventana. Contá las esquinas.',
          '¡Perfecto! El cuadrado tiene exactamente 4 esquinas.',
          'Un cuadrado tiene 4 esquinas, una en cada vértice.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.squareActivity,
        conceptId: shapesConcepts.square.id,
        activityId: shapesActivities.square.id,
        order: 6,
        stepType: 'activity',
        script: activityScript(
          'Vamos a practicar el cuadrado.',
          '¿Cuántas esquinas tiene un cuadrado?',
          [
            {
              text: '4',
              isCorrect: true,
              feedback: 'Correcto. El cuadrado tiene 4 esquinas.',
            },
            {
              text: '3',
              isCorrect: false,
              feedback: 'No. El triángulo tiene 3 esquinas, no el cuadrado.',
            },
            {
              text: '5',
              isCorrect: false,
              feedback: 'No. El cuadrado no tiene 5 esquinas.',
            },
          ],
          '¡Muy bien! El cuadrado tiene 4 esquinas.',
          'Pensá en una ventana cuadrada y contá sus esquinas.',
          'Ahora pasemos al triángulo.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.triangle,
        conceptId: shapesConcepts.triangle.id,
        order: 7,
        stepType: 'content',
        script: contentScript(
          'Llegó el turno del triángulo.',
          'El triángulo tiene 3 lados y 3 esquinas. Su nombre ya nos da una pista, porque “tri” significa tres.',
          [
            'Una rebanada de pizza puede tener forma de triángulo.',
            'Un letrero de advertencia a veces es triangular.',
            'Un sombrero de mago puede parecer un triángulo.',
          ],
          ['Tiene 3 lados', 'Tiene 3 esquinas', '“Tri” significa tres'],
          'Ahora vamos a practicar con una pregunta.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.triangleQuestion,
        conceptId: shapesConcepts.triangle.id,
        order: 8,
        stepType: 'question',
        script: questionScript(
          'Escuchá esta pregunta.',
          '¿Cuántos lados tiene un triángulo?',
          'Tres. Tiene 3 lados.',
          'Pista: el nombre de la figura ya te ayuda.',
          '¡Excelente! El triángulo tiene 3 lados.',
          'Muy bien. “Tri” nos indica que son tres.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.triangleActivity,
        conceptId: shapesConcepts.triangle.id,
        activityId: shapesActivities.triangle.id,
        order: 9,
        stepType: 'activity',
        script: activityScript(
          'Última práctica antes del examen.',
          '¿Cuál de estas cosas tiene forma de triángulo?',
          [
            {
              text: 'Una rebanada de pizza',
              isCorrect: true,
              feedback: 'Correcto. La pizza puede tener forma de triángulo.',
            },
            {
              text: 'Una moneda',
              isCorrect: false,
              feedback: 'No. La moneda se parece más a un círculo.',
            },
            {
              text: 'Una ventana cuadrada',
              isCorrect: false,
              feedback: 'No. La ventana cuadrada tiene forma de cuadrado.',
            },
          ],
          '¡Muy bien! La rebanada de pizza puede tener forma de triángulo.',
          'Recordá que el triángulo tiene 3 lados y 3 esquinas.',
          'Ya casi terminamos. Vamos al repaso.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.review,
        conceptId: shapesConcepts.review.id,
        order: 10,
        stepType: 'content',
        script: contentScript(
          'Hagamos un repaso rápido antes del examen.',
          'El círculo no tiene esquinas. El cuadrado tiene 4 lados iguales y 4 esquinas. El triángulo tiene 3 lados y 3 esquinas.',
          [
            'Una pelota puede parecer un círculo.',
            'Una ventana puede parecer un cuadrado.',
            'Una pizza puede parecer un triángulo.',
          ],
          [
            'Círculo = redondo',
            'Cuadrado = 4 lados y 4 esquinas',
            'Triángulo = 3 lados y 3 esquinas',
          ],
          'Muy bien. Ahora sí, vamos al examen final.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.exam,
        conceptId: shapesConcepts.review.id,
        activityId: shapesActivities.exam.id,
        order: 11,
        stepType: 'exam',
        script: examScript(
          'Llegó el examen. ¡Vos podés!',
          '¿Cuál opción es correcta?',
          [
            {
              text: 'El círculo no tiene esquinas',
              isCorrect: true,
              feedback: 'Correcto. El círculo no tiene esquinas.',
            },
            {
              text: 'El cuadrado tiene 3 lados',
              isCorrect: false,
              feedback: 'No. El cuadrado tiene 4 lados iguales.',
            },
            {
              text: 'El triángulo tiene 4 esquinas',
              isCorrect: false,
              feedback: 'No. El triángulo tiene 3 esquinas.',
            },
          ],
          '¡Excelente! Aprobaste el examen.',
          'Casi. Repasemos las formas una vez más.',
        ),
      }),
      stepData({
        recipeId: shapesRecipeId,
        atomId: shapesAtoms.closure,
        order: 12,
        stepType: 'closure',
        script: introScript(
          '¡Terminaste la clase!',
          'Hoy aprendiste tres figuras importantes: el círculo, que no tiene esquinas; el cuadrado, que tiene 4 lados iguales y 4 esquinas; y el triángulo, que tiene 3 lados y 3 esquinas. ¡Buscalos en tu casa!',
        ),
      }),
    ];

    await prisma.recipeStep.createMany({
      data: shapesSteps,
    });

    await prisma.userProgress.create({
      data: {
        id: randomUUID(),
        userId: TEST_STUDENT_ID,
        recipeId: mathRecipeId,
        status: 'IN_PROGRESS',
        attempts: 0,
      },
    });

    await prisma.userProgress.create({
      data: {
        id: randomUUID(),
        userId: TEST_STUDENT_ID,
        recipeId: shapesRecipeId,
        status: 'UNLOCKED',
        attempts: 0,
      },
    });

    const sessionId = randomUUID();

    await prisma.session.create({
      data: {
        id: sessionId,
        studentId: TEST_STUDENT_ID,
        recipeId: mathRecipeId,
        status: 'IDLE',
        stateCheckpoint: {
          currentState: 'AWAITING_START',
          currentStepIndex: 0,
          currentStepType: 'intro',
          currentStepId: mathAtoms.intro,
          questionCount: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          lastQuestionTime: null,
          lastFeedback: null,
          skippedActivities: [],
          failedAttempts: 0,
          completedSteps: [],
          pendingEvaluation: false,
        },
        meta: {
          locale: 'es-AR',
          seedVersion: '2.0.0',
          flowMode: 'STATIC_ORCHESTRATED',
        },
      },
    });

    console.log('\n🎉 Seed completed!');
    console.log('─────────────────────────────────────────────');
    console.log('📋 Recetas creadas:');
    console.log(`  Math:   ${mathRecipeId}  (${mathSteps.length} pasos)`);
    console.log(`  Shapes: ${shapesRecipeId}  (${shapesSteps.length} pasos)`);
    console.log('\n👤 Credenciales:');
    console.log('  student@test.pixel-mentor / testpassword123');
    console.log('  teacher@test.pixel-mentor / testpassword123');
    console.log(
      '\n💡 Todo el contenido quedó auto-contenido, estructurado y alineado al esquema Prisma.',
    );
    console.log('─────────────────────────────────────────────');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
