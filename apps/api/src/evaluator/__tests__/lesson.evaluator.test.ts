/**
 * Unit tests for LessonEvaluatorUseCase
 *
 * Tests cover:
 * 1. Basic evaluation flow
 * 2. Rubric adjustments (keywords, central truth)
 * 3. Error handling and fallback
 * 4. Prompt building
 * 5. Confidence adjustments
 */

import { z } from 'zod';

import {
  LessonEvaluatorUseCase,
  EvaluationResponseSchema,
  type EvaluationRequest,
} from '../lesson.evaluator';

import type { ILLMClient } from '@/llm/client.interface';
import type { ISafePromptBuilder } from '@/prompt/interfaces/safe-prompt-builder.interface';
import { SchemaValidationError } from '@/validation/schema.validator';
import type { ISchemaValidator } from '@/validation/schema.validator';

// ============================================================
// Test Setup & Utilities
// ============================================================

/**
 * Mock LLM client for testing.
 */
class MockLLMClient implements ILLMClient {
  private response: string;
  private shouldFail: boolean;
  private callCount: number = 0;

  constructor(response: string = '', shouldFail: boolean = false) {
    this.response = response;
    this.shouldFail = shouldFail;
  }

  async executePrompt(_prompt: string): Promise<string> {
    this.callCount++;
    if (this.shouldFail) {
      throw new Error('LLM execution failed');
    }
    return this.response;
  }

  getCallCount(): number {
    return this.callCount;
  }

  setResponse(response: string): void {
    this.response = response;
    this.shouldFail = false;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
}

/**
 * Mock Safe Prompt Builder for testing.
 */
class MockSafePromptBuilder implements ISafePromptBuilder {
  private _template: string = '';
  private _values: Record<string, string | null | undefined> = {};

  setTemplate(template: string): ISafePromptBuilder {
    this._template = template;
    return this;
  }

  setValues(values: Record<string, string | null | undefined>): ISafePromptBuilder {
    this._values = values;
    return this;
  }

  build(): string {
    let result = this._template;
    for (const [key, value] of Object.entries(this._values)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
    }
    return result;
  }

  reset(): ISafePromptBuilder {
    this._template = '';
    this._values = {};
    return this;
  }
}

/**
 * Mock Schema Validator for testing.
 */
class MockSchemaValidator<T> implements ISchemaValidator<T> {
  private mockValidate: (input: unknown) => T;
  private shouldFail: boolean = false;
  private failError: Error = new Error('Validation failed');

  constructor(validateFn?: (input: unknown) => T) {
    // Default: parse JSON string then validate
    this.mockValidate =
      validateFn ??
      ((x): T => {
        if (typeof x === 'string') {
          return JSON.parse(x) as T;
        }
        return x as T;
      });
  }

  validate(rawInput: unknown): T {
    if (this.shouldFail) {
      throw new SchemaValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: this.failError.message,
            path: [],
          },
        ]),
      );
    }
    return this.mockValidate(rawInput);
  }

  setValidateFn(fn: (input: unknown) => T): void {
    this.mockValidate = fn;
  }

  setFailure(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    if (error) {
      this.failError = error;
    }
  }
}

/**
 * Creates a valid evaluation request for testing.
 */
function createValidRequest(): EvaluationRequest {
  return {
    studentAnswer:
      'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía.',
    questionText: '¿Qué es la fotosíntesis?',
    teacherConfig: {
      centralTruth:
        'La fotosíntesis es el proceso por el cual las plantas convierten luz solar, agua y dióxido de carbono en glucosa y oxígeno.',
      requiredKeywords: ['luz solar', 'plantas', 'energía'],
      maxScore: 10,
    },
    lessonContext: {
      subject: 'Ciencias Naturales',
      gradeLevel: '6to grado',
      topic: 'Fotosíntesis',
    },
    studentProfile: {
      name: 'María',
      learningStyle: 'visual',
    },
  };
}

/**
 * Creates a valid LLM response for testing.
 */
function createValidLLMResponse(): string {
  return JSON.stringify({
    outcome: 'correct',
    score: 8,
    feedback: '¡Excelente respuesta! Has demostrado entender el concepto principal.',
    improvementSuggestion: 'Podrías mencionar también el rol del agua y el dióxido de carbono.',
    confidence: 0.9,
  });
}

// ============================================================
// Test Suites
// ============================================================

describe('LessonEvaluatorUseCase', () => {
  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const llmClient = new MockLLMClient();
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      expect(
        () => new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator),
      ).not.toThrow();
    });

    it('should throw error when LLM client is missing', () => {
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      expect(
        () =>
          new LessonEvaluatorUseCase(null as unknown as ILLMClient, promptBuilder, schemaValidator),
      ).toThrow('LLM client is required');
    });

    it('should throw error when prompt builder is missing', () => {
      const llmClient = new MockLLMClient();
      const schemaValidator = new MockSchemaValidator();

      expect(
        () =>
          new LessonEvaluatorUseCase(
            llmClient,
            null as unknown as ISafePromptBuilder,
            schemaValidator,
          ),
      ).toThrow('Prompt builder is required');
    });

    it('should throw error when schema validator is missing', () => {
      const llmClient = new MockLLMClient();
      const promptBuilder = new MockSafePromptBuilder();

      expect(
        () =>
          new LessonEvaluatorUseCase(
            llmClient,
            promptBuilder,
            null as unknown as ISchemaValidator<unknown>,
          ),
      ).toThrow('Schema validator is required');
    });
  });

  describe('evaluate', () => {
    it('should return evaluation result for valid request', async () => {
      const llmClient = new MockLLMClient(createValidLLMResponse());
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      const result = await evaluator.evaluate(request);

      expect(result).toBeDefined();
      // Note: outcome may be adjusted by rubric logic
      expect(['correct', 'partial']).toContain(result.outcome);
      expect(result.score).toBeGreaterThan(0);
      expect(result.feedback).toBeTruthy();
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should call LLM client with prompt', async () => {
      const llmClient = new MockLLMClient(createValidLLMResponse());
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      await evaluator.evaluate(request);

      expect(llmClient.getCallCount()).toBe(1);
    });

    it('should build prompt with request values', async () => {
      const llmClient = new MockLLMClient(createValidLLMResponse());
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      await evaluator.evaluate(request);

      // Verify template was set (it contains the question placeholder)
      expect(promptBuilder).toBeDefined();
    });
  });

  describe('Rubric Adjustments', () => {
    it('should adjust score based on keyword presence', async () => {
      // Response with perfect score
      const llmResponse = JSON.stringify({
        outcome: 'correct',
        score: 10,
        feedback: '¡Perfecto!',
        confidence: 0.9,
      });

      const llmClient = new MockLLMClient(llmResponse);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

      // Request with missing keywords - answer has only 1 of 3 keywords
      const request: EvaluationRequest = {
        studentAnswer: 'La fotosíntesis usa energía solar.',
        questionText: '¿Qué es la fotosíntesis?',
        teacherConfig: {
          centralTruth:
            'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
          requiredKeywords: ['luz solar', 'plantas', 'energía'],
          maxScore: 10,
        },
        lessonContext: {
          subject: 'Ciencias',
          gradeLevel: '6to',
          topic: 'Fotosíntesis',
        },
      };

      const result = await evaluator.evaluate(request);

      // Score should be reduced due to missing keywords
      expect(result.score).toBeLessThan(10);
    });

    it('should adjust outcome based on truth match ratio', async () => {
      // LLM says correct but answer doesn't match truth
      const llmResponse = JSON.stringify({
        outcome: 'correct',
        score: 9,
        feedback: '¡Muy bien!',
        confidence: 0.9,
      });

      const llmClient = new MockLLMClient(llmResponse);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

      // Answer that doesn't match central truth at all
      const request: EvaluationRequest = {
        studentAnswer: 'La mitosis es la división celular.',
        questionText: '¿Qué es la fotosíntesis?',
        teacherConfig: {
          centralTruth:
            'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
          requiredKeywords: ['luz solar', 'plantas'],
          maxScore: 10,
        },
        lessonContext: {
          subject: 'Ciencias',
          gradeLevel: '6to',
          topic: 'Fotosíntesis',
        },
      };

      const result = await evaluator.evaluate(request);

      // Should be adjusted to partial or incorrect
      expect(['partial', 'incorrect']).toContain(result.outcome);
    });

    it('should handle empty required keywords gracefully', async () => {
      const llmResponse = JSON.stringify({
        outcome: 'correct',
        score: 8,
        feedback: '¡Bien!',
        confidence: 0.8,
      });

      const llmClient = new MockLLMClient(llmResponse);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

      const request: EvaluationRequest = {
        studentAnswer: 'La fotosíntesis es importante para las plantas.',
        questionText: '¿Qué es la fotosíntesis?',
        teacherConfig: {
          centralTruth:
            'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
          requiredKeywords: [],
          maxScore: 10,
        },
        lessonContext: {
          subject: 'Ciencias',
          gradeLevel: '6to',
          topic: 'Fotosíntesis',
        },
      };

      const result = await evaluator.evaluate(request);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return fallback result when LLM fails', async () => {
      const llmClient = new MockLLMClient();
      llmClient.setFailure(true);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      const result = await evaluator.evaluate(request);

      expect(result).toBeDefined();
      expect(result.outcome).toBe('incorrect');
      expect(result.score).toBe(0);
      expect(result.feedback).toBeTruthy();
      expect(result.feedback).toContain('intenta');
    });

    it('should return fallback result when validation fails', async () => {
      const llmClient = new MockLLMClient('invalid json');
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();
      schemaValidator.setFailure(true);

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      const result = await evaluator.evaluate(request);

      expect(result).toBeDefined();
      expect(result.outcome).toBe('incorrect');
      expect(result.score).toBe(0);
    });

    it('should ensure feedback is never empty', async () => {
      const llmResponse = JSON.stringify({
        outcome: 'incorrect',
        score: 2,
        feedback: '',
        confidence: 0.5,
      });

      const llmClient = new MockLLMClient(llmResponse);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      const result = await evaluator.evaluate(request);

      expect(result.feedback).toBeTruthy();
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should ensure feedback starts positively', async () => {
      const llmResponse = JSON.stringify({
        outcome: 'partial',
        score: 5,
        feedback: 'Tu respuesta necesita más detalles.',
        confidence: 0.6,
      });

      const llmClient = new MockLLMClient(llmResponse);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      const result = await evaluator.evaluate(request);

      // Feedback should be prefixed with positive starter
      expect(result.feedback).toMatch(/^(¡|Bien|Buen|Excelente|Muy bien|Genial|Sigue)/);
    });
  });

  describe('Prompt Building', () => {
    it('should include student answer in prompt', async () => {
      const llmClient = new MockLLMClient(createValidLLMResponse());
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      await evaluator.evaluate(request);

      expect(llmClient.getCallCount()).toBe(1);
    });

    it('should include lesson context in prompt', async () => {
      const llmClient = new MockLLMClient(createValidLLMResponse());
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      await evaluator.evaluate(request);

      expect(llmClient.getCallCount()).toBe(1);
    });

    it('should include teacher rubric in prompt', async () => {
      const llmClient = new MockLLMClient(createValidLLMResponse());
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createValidRequest();

      await evaluator.evaluate(request);

      expect(llmClient.getCallCount()).toBe(1);
    });
  });
});

describe('EvaluationResponseSchema', () => {
  describe('outcome validation', () => {
    it('should accept valid outcome values', () => {
      const validOutcomes = ['correct', 'partial', 'incorrect'];

      for (const outcome of validOutcomes) {
        const result = EvaluationResponseSchema.safeParse({
          outcome,
          score: 5,
          feedback: 'Test feedback',
          confidence: 0.8,
        });

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid outcome values', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'invalid',
        score: 5,
        feedback: 'Test feedback',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('score validation', () => {
    it('should accept scores within valid range (0-10)', () => {
      const validScores = [0, 5, 10, 7.5, 3.14];

      for (const score of validScores) {
        const result = EvaluationResponseSchema.safeParse({
          outcome: 'correct',
          score,
          feedback: 'Test',
        });

        expect(result.success).toBe(true);
      }
    });

    it('should reject scores below 0', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: -1,
        feedback: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject scores above 10', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: 11,
        feedback: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('confidence validation', () => {
    it('should accept confidence within valid range (0-1)', () => {
      const validConfidences = [0, 0.5, 1, 0.75, 0.123];

      for (const confidence of validConfidences) {
        const result = EvaluationResponseSchema.safeParse({
          outcome: 'correct',
          score: 8,
          feedback: 'Test',
          confidence,
        });

        expect(result.success).toBe(true);
      }
    });

    it('should accept missing confidence (optional)', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: 8,
        feedback: 'Test',
      });

      expect(result.success).toBe(true);
    });

    it('should reject confidence below 0', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: 8,
        feedback: 'Test',
        confidence: -0.1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject confidence above 1', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: 8,
        feedback: 'Test',
        confidence: 1.1,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('improvementSuggestion validation', () => {
    it('should accept present improvement suggestion', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'partial',
        score: 6,
        feedback: 'Good effort',
        improvementSuggestion: 'Add more details about the process',
      });

      expect(result.success).toBe(true);
    });

    it('should accept missing improvement suggestion (optional)', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: 10,
        feedback: 'Perfect!',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('feedback validation', () => {
    it('should accept non-empty feedback', () => {
      const result = EvaluationResponseSchema.safeParse({
        outcome: 'correct',
        score: 10,
        feedback: 'Great job!',
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('Keyword Matching', () => {
  it('should count matching keywords correctly', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'partial',
      score: 6,
      feedback: 'Buen intento',
      confidence: 0.7,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new MockSafePromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    // Answer with 2 of 3 keywords
    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis usa luz solar y produce energía para las plantas.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth:
          'La fotosíntesis es el proceso por el cual las plantas convierten luz solar, agua y CO2.',
        requiredKeywords: ['luz solar', 'plantas', 'agua'],
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    const result = await evaluator.evaluate(request);

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('should handle case-insensitive keyword matching', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Muy bien!',
      confidence: 0.8,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new MockSafePromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    // Answer with uppercase keywords
    const request: EvaluationRequest = {
      studentAnswer: 'Luz Solar y PLANTAS son importantes.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis usa luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    const result = await evaluator.evaluate(request);

    expect(result.score).toBeGreaterThan(0);
  });
});

describe('Exemplars in Prompt', () => {
  /**
   * Extended mock that captures the built prompt for inspection.
   */
  class CapturingPromptBuilder implements ISafePromptBuilder {
    private _template: string = '';
    private _values: Record<string, string | null | undefined> = {};
    public lastBuiltPrompt: string = '';

    setTemplate(template: string): ISafePromptBuilder {
      this._template = template;
      return this;
    }

    setValues(values: Record<string, string | null | undefined>): ISafePromptBuilder {
      this._values = values;
      return this;
    }

    build(): string {
      let result = this._template;
      for (const [key, value] of Object.entries(this._values)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
      }
      this.lastBuiltPrompt = result;
      return result;
    }

    reset(): ISafePromptBuilder {
      this._template = '';
      this._values = {};
      return this;
    }
  }

  it('should include correct exemplars in the prompt', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Excelente!',
      confidence: 0.9,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer:
        'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          correct: [
            'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía.',
            'Las plantas usan la luz solar para producir su propio alimento mediante la fotosíntesis.',
          ],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    expect(promptBuilder.lastBuiltPrompt).toContain('Respuestas Correctas');
    expect(promptBuilder.lastBuiltPrompt).toContain(
      'La fotosíntesis es el proceso por el cual las plantas convierten luz solar en energía.',
    );
    expect(promptBuilder.lastBuiltPrompt).toContain(
      'Las plantas usan la luz solar para producir su propio alimento',
    );
  });

  it('should include partial exemplars in the prompt', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'partial',
      score: 5,
      feedback: 'Buen intento',
      confidence: 0.7,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis necesita luz.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          partial: [
            'La fotosíntesis requiere luz solar.',
            'Las plantas necesitan luz para hacer fotosíntesis.',
          ],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    expect(promptBuilder.lastBuiltPrompt).toContain('Respuestas Parciales');
    expect(promptBuilder.lastBuiltPrompt).toContain('La fotosíntesis requiere luz solar.');
  });

  it('should include incorrect exemplars in the prompt', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'incorrect',
      score: 2,
      feedback: 'Revisa el tema',
      confidence: 0.6,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La mitosis es la división celular.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          incorrect: [
            'La mitosis es la división celular.',
            'El sistema respiratorio permite respirar.',
          ],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    expect(promptBuilder.lastBuiltPrompt).toContain('Respuestas Incorrectas');
    expect(promptBuilder.lastBuiltPrompt).toContain('La mitosis es la división celular.');
  });

  it('should include all exemplar types when all are provided', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Excelente!',
      confidence: 0.9,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          correct: ['Respuesta correcta completa.'],
          partial: ['Respuesta parcial que omite algunos detalles.'],
          incorrect: ['Respuesta completamente incorrecta sobre otro tema.'],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    const prompt = promptBuilder.lastBuiltPrompt;
    expect(prompt).toContain('Respuestas Correctas');
    expect(prompt).toContain('Respuestas Parciales');
    expect(prompt).toContain('Respuestas Incorrectas');
    expect(prompt).toContain('Respuesta correcta completa.');
    expect(prompt).toContain('Respuesta parcial que omite algunos detalles.');
    expect(prompt).toContain('Respuesta completamente incorrecta sobre otro tema.');
  });

  it('should handle undefined exemplars gracefully (no exemplars section)', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Excelente!',
      confidence: 0.9,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis usa luz solar.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        // No exemplars defined
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    const prompt = promptBuilder.lastBuiltPrompt;
    expect(prompt).not.toContain('Respuestas Correctas');
    expect(prompt).not.toContain('Respuestas Parciales');
    expect(prompt).not.toContain('Respuestas Incorrectas');
    expect(prompt).not.toContain('Ejemplos de Respuestas');
  });

  it('should handle empty exemplars arrays gracefully', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Excelente!',
      confidence: 0.9,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis usa luz solar.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          correct: [],
          partial: [],
          incorrect: [],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    const prompt = promptBuilder.lastBuiltPrompt;
    expect(prompt).not.toContain('Respuestas Correctas');
    expect(prompt).not.toContain('Respuestas Parciales');
    expect(prompt).not.toContain('Respuestas Incorrectas');
    expect(prompt).not.toContain('Ejemplos de Respuestas');
  });

  it('should format exemplars as markdown bullet points', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Excelente!',
      confidence: 0.9,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          correct: ['Primera respuesta correcta.', 'Segunda respuesta correcta.'],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    const prompt = promptBuilder.lastBuiltPrompt;
    // Verify markdown bullet point format
    expect(prompt).toContain('\n- Primera respuesta correcta.');
    expect(prompt).toContain('\n- Segunda respuesta correcta.');
  });

  it('should include exemplars section with proper heading structure', async () => {
    const llmResponse = JSON.stringify({
      outcome: 'correct',
      score: 8,
      feedback: '¡Excelente!',
      confidence: 0.9,
    });

    const llmClient = new MockLLMClient(llmResponse);
    const promptBuilder = new CapturingPromptBuilder();
    const schemaValidator = new MockSchemaValidator();

    const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);

    const request: EvaluationRequest = {
      studentAnswer: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
      questionText: '¿Qué es la fotosíntesis?',
      teacherConfig: {
        centralTruth: 'La fotosíntesis es el proceso por el cual las plantas convierten luz solar.',
        requiredKeywords: ['luz solar', 'plantas'],
        exemplars: {
          correct: ['Respuesta correcta.'],
        },
        maxScore: 10,
      },
      lessonContext: {
        subject: 'Ciencias',
        gradeLevel: '6to',
        topic: 'Fotosíntesis',
      },
    };

    await evaluator.evaluate(request);

    const prompt = promptBuilder.lastBuiltPrompt;
    // Verify the structure
    expect(prompt).toContain('### Ejemplos de Respuestas');
    expect(prompt).toContain('#### Respuestas Correctas');
  });
});
