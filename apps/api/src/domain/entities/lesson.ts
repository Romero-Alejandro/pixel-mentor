import type { LessonChunk } from './lesson-chunk';

export interface Concept {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly example?: string;
}

export interface Analogy {
  readonly id: string;
  readonly text: string;
  readonly sourceDomain: string;
  readonly targetDomain: string;
}

export interface CommonError {
  readonly id: string;
  readonly incorrectConcept: string;
  readonly correctionExplanation: string;
}

export interface Question {
  readonly id: string;
  readonly lessonId: string;
  readonly text: string;
  readonly expectedAnswer: string;
  readonly feedbackExplanation?: string;
  readonly multipleChoiceOptions?: readonly string[];
  readonly order: number;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly concepts: readonly Concept[];
  readonly analogies: readonly Analogy[];
  readonly commonErrors: readonly CommonError[];
  readonly baseExplanation: string;
  readonly questions: readonly Question[];
  readonly chunks: readonly LessonChunk[];
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createLesson(parameters: {
  id: string;
  title: string;
  description?: string | null;
  concepts: Concept[];
  analogies: Analogy[];
  commonErrors: CommonError[];
  baseExplanation: string;
  questions: Question[];
  chunks?: LessonChunk[];
  active?: boolean;
}): Lesson {
  return {
    id: parameters.id,
    title: parameters.title,
    description: parameters.description ?? null,
    concepts: Object.freeze([...parameters.concepts]),
    analogies: Object.freeze([...parameters.analogies]),
    commonErrors: Object.freeze([...parameters.commonErrors]),
    baseExplanation: parameters.baseExplanation,
    questions: Object.freeze([...parameters.questions].sort((a, b) => a.order - b.order)),
    chunks: Object.freeze([...(parameters.chunks ?? [])]),
    active: parameters.active ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getQuestionByIndex(lesson: Lesson, index: number): Question | undefined {
  return lesson.questions[index];
}

export function getTotalQuestions(lesson: Lesson): number {
  return lesson.questions.length;
}

export function hasNextQuestion(lesson: Lesson, currentIndex: number): boolean {
  return currentIndex < lesson.questions.length - 1;
}

export function getChunks(lesson: Lesson): readonly LessonChunk[] {
  return lesson.chunks;
}

export type { LessonChunk };
