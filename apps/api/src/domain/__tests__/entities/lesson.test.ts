import { createLesson, getChunksOrdered } from '@/domain/entities/lesson';
import type { LessonChunk } from '@/domain/entities/lesson-chunk';

describe('Lesson Entity', () => {
  const baseLessonParams = {
    id: 'lesson-123',
    title: 'Introduction to Math',
    description: 'Basic arithmetic operations',
    concepts: [{ id: 'concept-1', title: 'Addition', description: 'Basic addition' }],
    analogies: [],
    commonErrors: [],
    baseExplanation: 'Addition is the process of combining two numbers',
    questions: [
      {
        id: 'question-1',
        lessonId: 'lesson-123',
        text: 'What is 2 + 2?',
        expectedAnswer: '4',
        order: 0,
      },
    ],
    chunks: [] as LessonChunk[],
    active: true,
  };

  it('should create a valid lesson', () => {
    const lesson = createLesson(baseLessonParams);

    expect(lesson.id).toBe('lesson-123');
    expect(lesson.title).toBe('Introduction to Math');
    expect(lesson.description).toBe('Basic arithmetic operations');
    expect(lesson.concepts.length).toBe(1);
    expect(lesson.questions.length).toBe(1);
    expect(lesson.active).toBe(true);
    expect(lesson.chunks).toEqual([]);
  });

  it('should create a lesson with long title', () => {
    const longTitle = 'A'.repeat(201);
    const lesson = createLesson({
      ...baseLessonParams,
      title: longTitle,
    });
    expect(lesson.title).toBe(longTitle);
  });

  it('should create a lesson with long description', () => {
    const longDescription = 'A'.repeat(10001);
    const lesson = createLesson({
      ...baseLessonParams,
      description: longDescription,
    });
    expect(lesson.description).toBe(longDescription);
  });

  describe('getChunksOrdered', () => {
    it('should return chunks ordered by order field', () => {
      const chunks: LessonChunk[] = [
        {
          id: 'chunk-3',
          lessonId: 'lesson-123',
          index: 2,
          chunkText: 'Third chunk',
          order: 2,
          embedding: null,
          tsvector: null,
          version: 1,
          isImmutable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'chunk-1',
          lessonId: 'lesson-123',
          index: 0,
          chunkText: 'First chunk',
          order: 0,
          embedding: null,
          tsvector: null,
          version: 1,
          isImmutable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'chunk-2',
          lessonId: 'lesson-123',
          index: 1,
          chunkText: 'Second chunk',
          order: 1,
          embedding: null,
          tsvector: null,
          version: 1,
          isImmutable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const lesson = createLesson({
        ...baseLessonParams,
        chunks,
      });

      const ordered = getChunksOrdered(lesson);
      expect(ordered.length).toBe(3);
      expect(ordered[0].id).toBe('chunk-1');
      expect(ordered[1].id).toBe('chunk-2');
      expect(ordered[2].id).toBe('chunk-3');
    });

    it('should return empty array if lesson has no chunks', () => {
      const lesson = createLesson(baseLessonParams);
      const ordered = getChunksOrdered(lesson);
      expect(ordered).toEqual([]);
    });
  });
});
