import { createLesson } from '@/domain/entities/lesson';

describe('Lesson Entity', () => {
  it('should create a valid lesson', () => {
    const lesson = createLesson({
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
      chunks: [],
      active: true,
    });

    expect(lesson.id).toBe('lesson-123');
    expect(lesson.title).toBe('Introduction to Math');
    expect(lesson.description).toBe('Basic arithmetic operations');
    expect(lesson.concepts.length).toBe(1);
    expect(lesson.questions.length).toBe(1);
    expect(lesson.active).toBe(true);
  });

  it('should create a lesson with long title', () => {
    const longTitle = 'A'.repeat(201);
    const lesson = createLesson({
      id: 'lesson-123',
      title: longTitle,
      description: 'Basic arithmetic operations',
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'Addition is the process of combining two numbers',
      questions: [],
      chunks: [],
      active: true,
    });
    expect(lesson.title).toBe(longTitle);
  });

  it('should create a lesson with long description', () => {
    const longDescription = 'A'.repeat(10001);
    const lesson = createLesson({
      id: 'lesson-123',
      title: 'Introduction to Math',
      description: longDescription,
      concepts: [],
      analogies: [],
      commonErrors: [],
      baseExplanation: 'Addition is the process of combining two numbers',
      questions: [],
      chunks: [],
      active: true,
    });
    expect(lesson.description).toBe(longDescription);
  });
});
