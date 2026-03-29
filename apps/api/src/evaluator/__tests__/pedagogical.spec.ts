/**
 * Pedagogical Evaluator Tests
 *
 * Tests for the 3-step pedagogical evaluation flow:
 * 1. Extract Concepts
 * 2. Classify (6 categories)
 * 3. Generate Feedback
 *
 * These tests verify the new behavior focused on understanding children's responses
 * rather than keyword matching.
 */

import { z } from 'zod';

import { LessonEvaluatorUseCase, type EvaluationRequest } from '../lesson.evaluator';
import { EVALUATION_OUTCOME } from '../types';

import type { ILLMClient } from '@/llm/client.interface';
import type { ISafePromptBuilder } from '@/prompt/interfaces/safe-prompt-builder.interface';
import { SchemaValidationError } from '@/validation/schema.validator';
import type { ISchemaValidator } from '@/validation/schema.validator';

// ============================================================
// Test Setup & Utilities
// ============================================================

/**
 * Mock LLM client that returns configurable responses for each step.
 */
class MockPedagogicalLLMClient implements ILLMClient {
  private responses: string[] = [];
  private responseIndex = 0;
  private shouldFail = false;
  private callCount = 0;

  constructor(responses: string[] = []) {
    this.responses = responses;
  }

  setResponses(responses: string[]): void {
    this.responses = responses;
    this.responseIndex = 0;
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async executePrompt(_prompt: string): Promise<string> {
    this.callCount++;
    if (this.shouldFail) {
      throw new Error('LLM execution failed');
    }
    if (this.responses.length === 0) {
      return '{}';
    }
    if (this.responseIndex >= this.responses.length) {
      return this.responses[this.responses.length - 1];
    }
    return this.responses[this.responseIndex++];
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.responseIndex = 0;
  }
}

/**
 * Mock Safe Prompt Builder for testing.
 */
class MockSafePromptBuilder implements ISafePromptBuilder {
  private _template = '';
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
 * Mock Schema Validator that validates against Zod schemas.
 */
class MockSchemaValidator<T> implements ISchemaValidator<T> {
  private mockValidate: (input: unknown) => T;
  private shouldFail = false;
  private failError = new Error('Validation failed');

  constructor(validateFn?: (input: unknown) => T) {
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

  setFailure(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    if (error) {
      this.failError = error;
    }
  }
}

/**
 * Creates a standard evaluation request for testing.
 */
function createRequest(studentAnswer: string): EvaluationRequest {
  return {
    studentAnswer,
    questionText: '¿Qué es la fotosíntesis?',
    teacherConfig: {
      centralTruth:
        'La fotosíntesis es el proceso por el cual las plantas convierten luz solar, agua y CO2 en glucosa y oxígeno.',
      requiredKeywords: ['luz solar', 'plantas', 'glucosa'],
      maxScore: 10,
    },
    lessonContext: {
      subject: 'Ciencias Naturales',
      gradeLevel: '4to grado',
      topic: 'Fotosíntesis',
    },
    studentProfile: {
      name: 'Lucas',
      learningStyle: 'visual',
    },
  };
}

// ============================================================
// Test Suites
// ============================================================

describe('Pedagogical LessonEvaluatorUseCase', () => {
  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      const llmClient = new MockPedagogicalLLMClient();
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
  });

  describe('3-Step Flow', () => {
    it('should make exactly 3 LLM calls (extract, classify, feedback)', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        // Step 1: Extract concepts
        JSON.stringify({
          ideas: ['las plantas usan luz solar'],
          languageComplexity: 'simple',
          hasAnalogies: false,
        }),
        // Step 2: Classify
        JSON.stringify({
          outcome: 'intuitive_correct',
          score: 8,
          justification: 'El niño entiende que las plantas usan luz solar',
          confidence: 0.9,
        }),
        // Step 3: Feedback
        JSON.stringify({
          feedback: '¡Muy bien Lucas! Has entendido que las plantas usan el sol. ¡Genial!',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('Las plantas usan el sol para vivir');

      await evaluator.evaluate(request);

      expect(llmClient.getCallCount()).toBe(3);
    });

    it('should return intuitive_correct for answer using simple language', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['las plantas usan el sol para comer'],
          languageComplexity: 'simple',
          hasAnalogies: true,
        }),
        JSON.stringify({
          outcome: 'intuitive_correct',
          score: 8,
          justification: 'El niño entiende la relación sol-planta usando analogía de "comer"',
          confidence: 0.9,
        }),
        JSON.stringify({
          feedback: '¡Muy bien! Has entendido que las plantas usan el sol.',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('Las plantas usan el sol para comer');

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.INTUITIVE_CORRECT);
      expect(result.score).toBe(8);
    });

    it('should return partially_correct for incomplete answer', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['las plantas necesitan luz'],
          languageComplexity: 'simple',
          hasAnalogies: false,
        }),
        JSON.stringify({
          outcome: 'partially_correct',
          score: 5,
          justification: 'La respuesta menciona luz pero no el proceso completo',
          confidence: 0.7,
        }),
        JSON.stringify({
          feedback: '¡Buen comienzo! Las plantas sí usan la luz. ¿Qué más crees que necesitan?',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('Las plantas necesitan luz');

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.PARTIALLY_CORRECT);
      expect(result.feedback).toContain('luz');
    });

    it('should return conceptually_correct for complete technical answer', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['fotosíntesis', 'luz solar', 'dióxido de carbono', 'glucosa', 'oxígeno'],
          languageComplexity: 'advanced',
          hasAnalogies: false,
        }),
        JSON.stringify({
          outcome: 'conceptually_correct',
          score: 10,
          justification: 'Respuesta completa con terminología técnica adecuada',
          confidence: 0.95,
        }),
        JSON.stringify({
          feedback: '¡Excelente! Has demostrado un conocimiento completo de la fotosíntesis.',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest(
        'La fotosíntesis es el proceso donde las plantas usan luz solar, CO2 y agua para producir glucosa y oxígeno.',
      );

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.CONCEPTUALLY_CORRECT);
    });

    it('should return conceptual_error for wrong understanding', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['las plantas respiran二氧化碳'],
          languageComplexity: 'moderate',
          hasAnalogies: false,
        }),
        JSON.stringify({
          outcome: 'conceptual_error',
          score: 1,
          justification: 'Confusión entre fotosíntesis y respiración',
          confidence: 0.8,
        }),
        JSON.stringify({
          feedback:
            '¡Buen intento! Las plantas sí respiran, pero la fotosíntesis es diferente. Es el proceso de hacer su propio alimento usando la luz del sol. ¡Sigue aprendiendo!',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('Las plantas respiran como los animales');

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.CONCEPTUAL_ERROR);
      expect(result.feedback).toContain('intento');
    });
  });

  describe('Feedback Coherence', () => {
    it('should generate feedback that matches the classification', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['el sol seca el agua'],
          languageComplexity: 'simple',
          hasAnalogies: false,
        }),
        JSON.stringify({
          outcome: 'partially_correct',
          score: 4,
          justification: 'Solo menciona una parte del ciclo del agua',
          confidence: 0.6,
        }),
        JSON.stringify({
          feedback: '¡Muy bien! Has notado que el sol seca el agua. ¿A dónde va el agua después?',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('El sol seca el agua');

      const result = await evaluator.evaluate(request);

      // Verify feedback contains positive reinforcement
      expect(result.feedback).toMatch(/¡Muy bien!|¡Buen|Genial|Excelente/);
      // Verify feedback mentions the concept the child got right
      expect(result.feedback.toLowerCase()).toContain('sol');
      expect(result.feedback.toLowerCase()).toContain('agua');
    });

    it('should ensure feedback is always positive for children', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: [],
          languageComplexity: 'simple',
          hasAnalogies: false,
        }),
        JSON.stringify({
          outcome: 'no_response',
          score: 0,
          justification: 'No hay respuesta',
          confidence: 1,
        }),
        JSON.stringify({
          feedback: '¡Aún no has respondido! Pero no te preocupes, haz tu mejor intento.',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('');

      const result = await evaluator.evaluate(request);

      // Feedback should not be negative
      expect(result.feedback.toLowerCase()).not.toContain('mal');
      expect(result.feedback.toLowerCase()).not.toContain('incorrecto');
    });
  });

  describe('Error Handling', () => {
    it('should return fallback result when LLM fails at any step', async () => {
      const llmClient = new MockPedagogicalLLMClient();
      llmClient.setFailure(true);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('Las plantas necesitan sol');

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.NO_RESPONSE);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('intenta');
    });

    it('should return fallback when validation fails', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['test'],
          languageComplexity: 'simple',
          hasAnalogies: false,
        }),
        'invalid json',
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();
      schemaValidator.setFailure(true);

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('Test answer');

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.NO_RESPONSE);
    });
  });

  describe('Normalization', () => {
    it('should handle answers with extra whitespace', async () => {
      const llmClient = new MockPedagogicalLLMClient([
        JSON.stringify({
          ideas: ['las plantas usan el sol'],
          languageComplexity: 'simple',
          hasAnalogies: false,
        }),
        JSON.stringify({
          outcome: 'intuitive_correct',
          score: 8,
          justification: 'Entiende la relación planta-sol',
          confidence: 0.9,
        }),
        JSON.stringify({
          feedback: '¡Genial!',
        }),
      ]);
      const promptBuilder = new MockSafePromptBuilder();
      const schemaValidator = new MockSchemaValidator();

      const evaluator = new LessonEvaluatorUseCase(llmClient, promptBuilder, schemaValidator);
      const request = createRequest('  Las plantas   usan el    sol  ');

      const result = await evaluator.evaluate(request);

      expect(result.outcome).toBe(EVALUATION_OUTCOME.INTUITIVE_CORRECT);
    });
  });
});

describe('EVALUATION_OUTCOME constant', () => {
  it('should have all 6 required categories', () => {
    expect(EVALUATION_OUTCOME.CONCEPTUALLY_CORRECT).toBe('conceptually_correct');
    expect(EVALUATION_OUTCOME.INTUITIVE_CORRECT).toBe('intuitive_correct');
    expect(EVALUATION_OUTCOME.PARTIALLY_CORRECT).toBe('partially_correct');
    expect(EVALUATION_OUTCOME.RELEVANT_BUT_INCOMPLETE).toBe('relevant_but_incomplete');
    expect(EVALUATION_OUTCOME.CONCEPTUAL_ERROR).toBe('conceptual_error');
    expect(EVALUATION_OUTCOME.NO_RESPONSE).toBe('no_response');
  });
});
