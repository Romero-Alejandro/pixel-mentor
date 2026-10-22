import {
  detectScriptFormat,
  getGrader,
  mcqSingleGrader,
  mcqMultiGrader,
  trueFalseGrader,
  orderingGrader,
} from '../grading.js';
import type { ActivityResponse } from '../formats.js';

const mcqSingleScript = {
  kind: 'activity',
  format: 'mcq_single',
  instruction: 'Elegí la correcta',
  options: [
    { id: 'a', text: 'Madrid', isCorrect: false },
    { id: 'b', text: 'Paris', isCorrect: true },
  ],
  feedback: { correct: '¡Bien!', incorrect: 'Mal' },
};

const mcqMultiScript = {
  kind: 'activity',
  format: 'mcq_multi',
  instruction: 'Elegí todas las capitales',
  options: [
    { id: 'a', text: 'Paris', isCorrect: true },
    { id: 'b', text: 'Roma', isCorrect: true },
    { id: 'c', text: 'Madrid', isCorrect: false },
  ],
  feedback: { correct: '¡Bien!', incorrect: 'Mal', partial: 'Casi' },
};

const trueFalseScript = {
  kind: 'activity',
  format: 'true_false',
  instruction: 'La Tierra es plana',
  answer: false,
  feedback: { correct: '¡Bien!', incorrect: 'Mal' },
};

const orderingScript = {
  kind: 'activity',
  format: 'ordering',
  instruction: 'Ordená los pasos',
  items: [
    { id: 'i1', text: 'Nacer' },
    { id: 'i2', text: 'Crecer' },
    { id: 'i3', text: 'Aprender' },
  ],
  feedback: { correct: '¡Bien!', incorrect: 'Mal', partial: 'Casi' },
};

describe('detectScriptFormat', () => {
  it('detects explicit formats', () => {
    expect(detectScriptFormat(mcqMultiScript)).toBe('mcq_multi');
    expect(detectScriptFormat(trueFalseScript)).toBe('true_false');
    expect(detectScriptFormat(orderingScript)).toBe('ordering');
  });

  it('falls back to mcq_single for legacy content', () => {
    expect(detectScriptFormat({ instruction: 'x', options: [{ text: 'a', isCorrect: true }] })).toBe(
      'mcq_single',
    );
    expect(detectScriptFormat(null)).toBe('mcq_single');
  });

  it('infers ordering from items when format is missing', () => {
    expect(detectScriptFormat({ items: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }] })).toBe(
      'ordering',
    );
  });

  it('infers true_false from a boolean answer when format is missing', () => {
    expect(detectScriptFormat({ instruction: 'x', answer: true })).toBe('true_false');
  });
});

describe('registry', () => {
  it('resolves a grader for every format', () => {
    expect(getGrader('mcq_single')?.format).toBe('mcq_single');
    expect(getGrader('mcq_multi')?.format).toBe('mcq_multi');
    expect(getGrader('true_false')?.format).toBe('true_false');
    expect(getGrader('ordering')?.format).toBe('ordering');
  });

  it('matches scripts by format', () => {
    expect(mcqSingleGrader.matchesScript(mcqSingleScript)).toBe(true);
    expect(mcqMultiGrader.matchesScript(mcqMultiScript)).toBe(true);
    expect(trueFalseGrader.matchesScript(trueFalseScript)).toBe(true);
    expect(orderingGrader.matchesScript(orderingScript)).toBe(true);
    // Cross-format mismatches
    expect(orderingGrader.matchesScript(mcqSingleScript)).toBe(false);
    expect(mcqSingleGrader.matchesScript(orderingScript)).toBe(false);
    expect(trueFalseGrader.matchesScript(mcqMultiScript)).toBe(false);
  });
});

describe('mcq_multi grader', () => {
  const grader = getGrader('mcq_multi')!;

  it('grades a fully correct selection', () => {
    const result = grader.grade(mcqMultiScript, {
      studentInput: 'respuesta',
      structured: { format: 'mcq_multi', optionIds: ['a', 'b'] } as ActivityResponse,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
    expect(result.correctAnswer).toEqual(['a', 'b']);
  });

  it('scores partial selections and penalizes wrong picks', () => {
    const partial = grader.grade(mcqMultiScript, {
      studentInput: 'respuesta',
      structured: { format: 'mcq_multi', optionIds: ['a'] } as ActivityResponse,
    });
    expect(partial.isCorrect).toBe(false);
    expect(partial.score).toBeCloseTo(0.5);

    const withMiss = grader.grade(mcqMultiScript, {
      studentInput: 'respuesta',
      structured: { format: 'mcq_multi', optionIds: ['a', 'c'] } as ActivityResponse,
    });
    expect(withMiss.isCorrect).toBe(false);
    expect(withMiss.score).toBe(0);
  });

  it('ignores unknown option ids', () => {
    const result = grader.grade(mcqMultiScript, {
      studentInput: 'respuesta',
      structured: { format: 'mcq_multi', optionIds: ['a', 'zzz'] } as ActivityResponse,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeCloseTo(0.5);
  });
});

describe('true_false grader', () => {
  const grader = getGrader('true_false')!;

  it('grades a structured boolean', () => {
    const ok = grader.grade(trueFalseScript, {
      studentInput: 'respuesta',
      structured: { format: 'true_false', value: false } as ActivityResponse,
    });
    expect(ok.isCorrect).toBe(true);
    expect(ok.correctAnswer).toBe(false);

    const bad = grader.grade(trueFalseScript, {
      studentInput: 'respuesta',
      structured: { format: 'true_false', value: true } as ActivityResponse,
    });
    expect(bad.isCorrect).toBe(false);
  });

  it('parses voice text answers (es/en)', () => {
    expect(grader.grade(trueFalseScript, { studentInput: 'Falso' }).isCorrect).toBe(true);
    expect(grader.grade(trueFalseScript, { studentInput: 'verdadero' }).isCorrect).toBe(false);
  });
});

describe('ordering grader', () => {
  const grader = getGrader('ordering')!;

  it('grades the exact correct order', () => {
    const result = grader.grade(orderingScript, {
      studentInput: 'respuesta',
      structured: { format: 'ordering', itemIds: ['i1', 'i2', 'i3'] } as ActivityResponse,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
    expect(result.correctAnswer).toEqual(['i1', 'i2', 'i3']);
  });

  it('gives partial score and per-position feedback when some are misplaced', () => {
    const result = grader.grade(orderingScript, {
      studentInput: 'respuesta',
      structured: { format: 'ordering', itemIds: ['i1', 'i3', 'i2'] } as ActivityResponse,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeCloseTo(1 / 3);
    const positions = (result as { correctPositions?: boolean[] }).correctPositions;
    expect(positions).toEqual([true, false, false]);
  });

  it('detects a fully reversed order as incorrect', () => {
    const result = grader.grade(orderingScript, {
      studentInput: 'respuesta',
      structured: { format: 'ordering', itemIds: ['i3', 'i2', 'i1'] } as ActivityResponse,
    });
    expect(result.isCorrect).toBe(false);
    // Rank-based comparison: the middle item (i2) keeps its relative position.
    expect(result.score).toBeCloseTo(1 / 3);
    const positions = (result as { correctPositions?: boolean[] }).correctPositions;
    expect(positions).toEqual([false, true, false]);
  });
});

describe('mcq_single grader (registry path)', () => {
  it('grades by option id and keeps the reveal id', () => {
    const result = mcqSingleGrader.grade(mcqSingleScript, { studentInput: 'texto', optionId: 'b' });
    expect(result.isCorrect).toBe(true);
    expect(result.correctOptionId).toBe('b');
  });
});

describe('structured payload type sanity', () => {
  it('accepts the three Fase 1 payload shapes', () => {
    const payloads: ActivityResponse[] = [
      { format: 'mcq_multi', optionIds: ['a'] },
      { format: 'true_false', value: true },
      { format: 'ordering', itemIds: ['a', 'b'] },
    ];
    expect(payloads).toHaveLength(3);
  });
});
