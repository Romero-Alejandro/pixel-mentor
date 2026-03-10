import {
  evaluateAnswer,
  evaluateMultipleChoice,
  calculateTotalScore,
} from '@/domain/state/response-evaluator';

describe('ResponseEvaluator', () => {
  it('should evaluate correct answer', () => {
    const question = {
      id: 'question-1',
      lessonId: 'lesson-1',
      text: 'What is 2 + 2?',
      expectedAnswer: '4',
      order: 0,
    };

    const evaluation = evaluateAnswer(question, '4');
    expect(evaluation.isCorrect).toBe(true);
    expect(evaluation.score).toBe(100);
    expect(evaluation.feedback).toContain('correct');
  });

  it('should evaluate incorrect answer', () => {
    const question = {
      id: 'question-1',
      lessonId: 'lesson-1',
      text: 'What is 2 + 2?',
      expectedAnswer: '4',
      order: 0,
    };

    const evaluation = evaluateAnswer(question, '3');
    expect(evaluation.isCorrect).toBe(false);
    expect(evaluation.score).toBeLessThan(100);
    expect(evaluation.feedback).toContain('No es correcto');
  });

  it('should evaluate partially correct answer', () => {
    const question = {
      id: 'question-1',
      lessonId: 'lesson-1',
      text: 'What is 2 + 2?',
      expectedAnswer: '4',
      order: 0,
    };

    const evaluation = evaluateAnswer(question, '42');
    expect(evaluation.isCorrect).toBe(false);
    expect(evaluation.score).toBe(50);
    expect(evaluation.feedback).toContain('Casi lo tienes');
  });

  it('should evaluate multiple choice answer', () => {
    const question = {
      id: 'question-1',
      lessonId: 'lesson-1',
      text: 'What is the capital of France?',
      expectedAnswer: 'Paris',
      order: 0,
      multipleChoiceOptions: ['Paris', 'London', 'Berlin'],
    };

    const evaluation = evaluateMultipleChoice(question, 'Paris');
    expect(evaluation.isCorrect).toBe(true);
    expect(evaluation.score).toBe(100);
  });

  it('should calculate total score', () => {
    const evaluations = [
      { isCorrect: true, score: 100, feedback: 'Correct' },
      { isCorrect: false, score: 50, feedback: 'Partial' },
      { isCorrect: true, score: 100, feedback: 'Correct' },
    ];

    const totalScore = calculateTotalScore(evaluations);
    expect(totalScore).toBe(83);
  });
});
