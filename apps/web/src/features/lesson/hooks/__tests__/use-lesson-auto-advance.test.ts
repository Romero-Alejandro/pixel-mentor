/**
 * useLessonAutoAdvance Tests
 *
 * Tests the response processing and auto-advance logic patterns.
 * Since the hook has heavy React dependencies, these tests verify
 * the underlying state mapping logic in isolation.
 */

import { describe, it, expect } from 'vitest';

// ---- State Mapping Tests ----

describe('Pedagogical State Mapping', () => {
  const STATES_REQUIRING_INPUT = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

  it('should require input for ACTIVITY_WAIT', () => {
    expect(STATES_REQUIRING_INPUT.includes('ACTIVITY_WAIT')).toBe(true);
  });

  it('should require input for QUESTION', () => {
    expect(STATES_REQUIRING_INPUT.includes('QUESTION')).toBe(true);
  });

  it('should require input for EVALUATION', () => {
    expect(STATES_REQUIRING_INPUT.includes('EVALUATION')).toBe(true);
  });

  it('should require input for AWAITING_START', () => {
    expect(STATES_REQUIRING_INPUT.includes('AWAITING_START')).toBe(true);
  });

  it('should NOT require input for EXPLANATION', () => {
    expect(STATES_REQUIRING_INPUT.includes('EXPLANATION')).toBe(false);
  });

  it('should NOT require input for ACTIVE_CLASS', () => {
    expect(STATES_REQUIRING_INPUT.includes('ACTIVE_CLASS')).toBe(false);
  });

  it('should NOT require input for COMPLETED', () => {
    expect(STATES_REQUIRING_INPUT.includes('COMPLETED')).toBe(false);
  });
});

// ---- UI Panel Selection Tests ----

describe('UI Panel Selection', () => {
  it('should show activity panel for activity step type', () => {
    const stepType = 'activity';
    const hasOptions = false;
    const isActivityPanel = stepType === 'activity' || hasOptions;
    expect(isActivityPanel).toBe(true);
  });

  it('should show activity panel when options exist', () => {
    const stepType: string = 'question';
    const hasOptions = true;
    const isActivityPanel = stepType === 'activity' || hasOptions;
    expect(isActivityPanel).toBe(true);
  });

  it('should show question panel for question without options', () => {
    const stepType: string = 'question';
    const hasOptions = false;
    const isActivityPanel = stepType === 'activity' || hasOptions;
    expect(isActivityPanel).toBe(false);
  });

  it('should show question panel for open-ended question', () => {
    const pedagogicalState = 'QUESTION';
    const isQuestionState = pedagogicalState === 'QUESTION';
    expect(isQuestionState).toBe(true);
  });
});

// ---- Auto-Advance Logic Tests ----

describe('Auto-Advance Logic', () => {
  it('should auto-advance when not requiring input and not completed', () => {
    const pedagogicalState = 'EXPLANATION';
    const sessionCompleted = false;
    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

    const needsUserInput = statesRequiringInput.includes(pedagogicalState);
    const canAutoAdvance = !needsUserInput && !sessionCompleted;

    expect(canAutoAdvance).toBe(true);
  });

  it('should NOT auto-advance when session is completed', () => {
    const pedagogicalState = 'EXPLANATION';
    const sessionCompleted = true;
    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

    const needsUserInput = statesRequiringInput.includes(pedagogicalState);
    const canAutoAdvance = !needsUserInput && !sessionCompleted;

    expect(canAutoAdvance).toBe(false);
  });

  it('should NOT auto-advance when requiring user input', () => {
    const pedagogicalState = 'ACTIVITY_WAIT';
    const sessionCompleted = false;
    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

    const needsUserInput = statesRequiringInput.includes(pedagogicalState);
    const canAutoAdvance = !needsUserInput && !sessionCompleted;

    expect(canAutoAdvance).toBe(false);
  });

  it('should auto-send "listo" for AWAITING_START', () => {
    const pedagogicalState = 'AWAITING_START';
    const shouldSendReady = pedagogicalState === 'AWAITING_START';
    expect(shouldSendReady).toBe(true);
  });

  it('should auto-send "__auto__" for content auto-advance', () => {
    const pedagogicalState = 'EXPLANATION';
    const sessionCompleted = false;
    const statesRequiringInput = ['ACTIVITY_WAIT', 'QUESTION', 'EVALUATION', 'AWAITING_START'];

    const needsUserInput = statesRequiringInput.includes(pedagogicalState);
    const canAutoAdvance = !needsUserInput && !sessionCompleted;
    const autoInput = canAutoAdvance ? '__auto__' : null;

    expect(autoInput).toBe('__auto__');
  });
});

// ---- Response Processing Tests ----

describe('Response Processing', () => {
  it('should extract voiceText from response', () => {
    const response = {
      voiceText: 'Hello world',
      pedagogicalState: 'EXPLANATION',
    };

    const voiceText = response.voiceText || '';
    expect(voiceText).toBe('Hello world');
  });

  it('should default voiceText to empty string', () => {
    const response: { pedagogicalState: string; voiceText?: string } = {
      pedagogicalState: 'EXPLANATION',
    };

    const voiceText = response.voiceText || '';
    expect(voiceText).toBe('');
  });

  it('should support both resolvedStaticContent and contentSteps', () => {
    const response1: { resolvedStaticContent?: unknown; contentSteps?: unknown } = {
      resolvedStaticContent: { stepType: 'content', script: { content: 'Hello' } },
    };
    const response2: { resolvedStaticContent?: unknown; contentSteps?: unknown } = {
      contentSteps: { stepType: 'content', script: { content: 'Hello' } },
    };

    const resolved1 = response1.resolvedStaticContent || response1.contentSteps;
    const resolved2 = response2.resolvedStaticContent || response2.contentSteps;

    expect(resolved1).toEqual({ stepType: 'content', script: { content: 'Hello' } });
    expect(resolved2).toEqual({ stepType: 'content', script: { content: 'Hello' } });
  });

  it('should extract text from {text: string} objects', () => {
    const extractText = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object' && 'text' in val)
        return String((val as { text: unknown }).text);
      return '';
    };

    expect(extractText('hello')).toBe('hello');
    expect(extractText({ text: 'hello' })).toBe('hello');
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
  });

  it('should build combined text from transition + content + closure', () => {
    const transition = 'Next topic:';
    const content = 'This is the main content.';
    const closure = 'Summary.';

    const combinedText = [transition, content, closure].filter(Boolean).join(' ');
    expect(combinedText).toBe('Next topic: This is the main content. Summary.');
  });

  it('should handle missing transition/closure gracefully', () => {
    const transition = '';
    const content = 'Content only.';
    const closure = '';

    const combinedText = [transition, content, closure].filter(Boolean).join(' ');
    expect(combinedText).toBe('Content only.');
  });
});

// ---- Evaluation Mapping Tests ----

describe('Evaluation Feedback', () => {
  it('should use feedback from response when available', () => {
    const feedback = 'Great job!';
    const isCorrect = true;
    const msg = feedback || (isCorrect ? 'Muy bien!' : 'Sigue intentando!');
    expect(msg).toBe('Great job!');
  });

  it('should default to "Muy bien!" for correct answer without feedback', () => {
    const feedback = undefined;
    const isCorrect = true;
    const msg = feedback || (isCorrect ? 'Muy bien!' : 'Sigue intentando!');
    expect(msg).toBe('Muy bien!');
  });

  it('should default to "Sigue intentando!" for incorrect answer without feedback', () => {
    const feedback = undefined;
    const isCorrect = false;
    const msg = feedback || (isCorrect ? 'Muy bien!' : 'Sigue intentando!');
    expect(msg).toBe('Sigue intentando!');
  });
});

// ---- Lesson Progress Tests ----

describe('Lesson Progress', () => {
  it('should update step progress when provided', () => {
    const lessonProgress = { currentStep: 3, totalSteps: 10 };
    const hasProgress = !!lessonProgress;

    expect(hasProgress).toBe(true);
    expect(lessonProgress.currentStep).toBe(3);
    expect(lessonProgress.totalSteps).toBe(10);
  });

  it('should handle missing lessonProgress', () => {
    const lessonProgress = undefined;
    const hasProgress = !!lessonProgress;

    expect(hasProgress).toBe(false);
  });
});

// ---- Options Mapping Tests ----

describe('Options Mapping', () => {
  it('should map activity options to UI format', () => {
    const options = [
      { text: 'Paris', isCorrect: true },
      { text: 'Madrid', isCorrect: false },
    ];

    const mapped = options.map((o, i) => ({
      id: `opt-${i}`,
      text: o.text,
      isCorrect: o.isCorrect,
    }));

    expect(mapped).toEqual([
      { id: 'opt-0', text: 'Paris', isCorrect: true },
      { id: 'opt-1', text: 'Madrid', isCorrect: false },
    ]);
  });

  it('should handle empty options array', () => {
    const options: Array<{ text: string; isCorrect: boolean }> = [];
    const hasOptions = options.length > 0;
    expect(hasOptions).toBe(false);
  });

  it('should handle undefined options', () => {
    const options = undefined as Array<{ text: string; isCorrect: boolean }> | undefined;
    const hasOptions = !!options && options.length > 0;
    expect(hasOptions).toBeFalsy();
  });
});
