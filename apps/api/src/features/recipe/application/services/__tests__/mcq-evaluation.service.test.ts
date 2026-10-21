import {
  evaluateMCQ,
  isMCQStepType,
  isQuestionStepType,
  type ActivityScript,
} from '@/features/recipe/application/services/mcq-evaluation.service.js';

// Mock logger
jest.mock('@/shared/logger/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('MCQEvaluationService', () => {
  describe('evaluateMCQ — optionId grading (Fase 0)', () => {
    const scriptWithIds: ActivityScript = {
      instruction: 'Select the correct answer',
      options: [
        { id: 'a1', text: 'Madrid', isCorrect: false },
        { id: 'b2', text: 'Paris', isCorrect: true },
        { id: 'c3', text: 'Roma', isCorrect: false },
      ],
      feedback: { correct: 'Excellent!', incorrect: 'Try again.' },
    };

    it('grades by option id when provided', () => {
      const result = evaluateMCQ(scriptWithIds, 'cualquier texto', { optionId: 'b2' });
      expect(result.isCorrect).toBe(true);
      expect(result.selectedOptionId).toBe('b2');
      expect(result.correctOptionId).toBe('b2');
    });

    it('grades incorrect when the option id points to a distractor (even with matching text)', () => {
      const result = evaluateMCQ(scriptWithIds, 'Madrid', { optionId: 'a1' });
      expect(result.isCorrect).toBe(false);
      expect(result.selectedOptionId).toBe('a1');
    });

    it('falls back to positional ids (opt-<index>) for legacy clients', () => {
      const result = evaluateMCQ(scriptWithIds, 'Paris', { optionId: 'opt-1' });
      expect(result.isCorrect).toBe(true);
      expect(result.selectedOptionId).toBe('b2');
    });

    it('falls back to text matching when the option id is unknown (legacy content)', () => {
      const legacyScript: ActivityScript = {
        instruction: 'Select the correct answer',
        options: [
          { text: 'Madrid', isCorrect: false },
          { text: 'Paris', isCorrect: true },
          { text: 'Roma', isCorrect: false },
        ],
        feedback: { correct: 'Excellent!', incorrect: 'Try again.' },
      };
      const result = evaluateMCQ(legacyScript, '  Paris  ', { optionId: 'unknown-id' });
      expect(result.isCorrect).toBe(true);
      expect(result.correctOptionId).toBeUndefined();
    });
  });

  describe('evaluateMCQ', () => {
    const baseScript: ActivityScript = {
      instruction: 'Select the correct answer',
      options: [
        { text: 'Madrid', isCorrect: false },
        { text: 'Paris', isCorrect: true },
        { text: 'Roma', isCorrect: false },
      ],
      feedback: {
        correct: 'Excellent!',
        incorrect: 'Try again.',
      },
    };

    it('should return isCorrect=true for exact match', () => {
      const result = evaluateMCQ(baseScript, 'Paris');
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe('Excellent!');
      expect(result.correctOptionText).toBe('Paris');
    });

    it('should return isCorrect=true for case-insensitive match', () => {
      const result = evaluateMCQ(baseScript, 'paris');
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe('Excellent!');
    });

    it('should return isCorrect=true for match with extra whitespace', () => {
      const result = evaluateMCQ(baseScript, '  Paris  ');
      expect(result.isCorrect).toBe(true);
    });

    it('should return isCorrect=true for mixed case', () => {
      const result = evaluateMCQ(baseScript, 'PaRiS');
      expect(result.isCorrect).toBe(true);
    });

    it('should return isCorrect=false for wrong answer', () => {
      const result = evaluateMCQ(baseScript, 'Madrid');
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toBe('Try again.');
    });

    it('should return isCorrect=false for partial match', () => {
      const result = evaluateMCQ(baseScript, 'Par');
      expect(result.isCorrect).toBe(false);
    });

    it('should return isCorrect=false for empty input', () => {
      const result = evaluateMCQ(baseScript, '');
      expect(result.isCorrect).toBe(false);
    });

    it('should use default feedback when script has no feedback', () => {
      const scriptWithoutFeedback: ActivityScript = {
        options: [{ text: 'A', isCorrect: true }],
      };
      const result = evaluateMCQ(scriptWithoutFeedback, 'A');
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe('Correct!');
    });

    it('should use default incorrect feedback when script has no feedback', () => {
      const scriptWithoutFeedback: ActivityScript = {
        options: [{ text: 'A', isCorrect: true }],
      };
      const result = evaluateMCQ(scriptWithoutFeedback, 'B');
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toBe('Incorrect.');
    });

    it('should return correctOptionText undefined when no options', () => {
      const emptyScript: ActivityScript = {
        options: [],
      };
      const result = evaluateMCQ(emptyScript, 'anything');
      expect(result.isCorrect).toBe(false);
      expect(result.correctOptionText).toBeUndefined();
    });

    it('should return correctOptionText undefined when options is undefined', () => {
      const noOptionsScript: ActivityScript = {};
      const result = evaluateMCQ(noOptionsScript, 'anything');
      expect(result.isCorrect).toBe(false);
      expect(result.correctOptionText).toBeUndefined();
    });

    it('should include normalizedInput in result', () => {
      const result = evaluateMCQ(baseScript, '  Paris  ');
      expect(result.normalizedInput).toBe('paris');
    });

    it('should handle multiple correct options (first one wins)', () => {
      const script: ActivityScript = {
        options: [
          { text: 'A', isCorrect: false },
          { text: 'B', isCorrect: true },
          { text: 'C', isCorrect: true },
        ],
        feedback: { correct: 'Good', incorrect: 'Bad' },
      };
      const result = evaluateMCQ(script, 'B');
      expect(result.isCorrect).toBe(true);
      expect(result.correctOptionText).toBe('B');
    });
  });

  describe('isMCQStepType', () => {
    it('should return true for activity', () => {
      expect(isMCQStepType('activity')).toBe(true);
    });

    it('should return true for exam', () => {
      expect(isMCQStepType('exam')).toBe(true);
    });

    it('should return true for ACTIVITY (uppercase)', () => {
      expect(isMCQStepType('ACTIVITY')).toBe(true);
    });

    it('should return true for EXAM (uppercase)', () => {
      expect(isMCQStepType('EXAM')).toBe(true);
    });

    it('should return false for question', () => {
      expect(isMCQStepType('question')).toBe(false);
    });

    it('should return false for content', () => {
      expect(isMCQStepType('content')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isMCQStepType(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMCQStepType(undefined)).toBe(false);
    });
  });

  describe('isQuestionStepType', () => {
    it('should return true for question', () => {
      expect(isQuestionStepType('question')).toBe(true);
    });

    it('should return true for QUESTION (uppercase)', () => {
      expect(isQuestionStepType('QUESTION')).toBe(true);
    });

    it('should return false for activity', () => {
      expect(isQuestionStepType('activity')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isQuestionStepType(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isQuestionStepType(undefined)).toBe(false);
    });
  });
});
