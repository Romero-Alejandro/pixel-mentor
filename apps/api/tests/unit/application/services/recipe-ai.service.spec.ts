import { RecipeAIService } from '@/application/services/recipe-ai.service.js';
import type { AIService } from '@/domain/ports/ai-service.js';
import type { GenerateRecipeDraftInput } from '@/application/services/recipe-ai.service.js';

// Mock AIService
const createMockAIService = (): jest.Mocked<AIService> => {
  const mock: jest.Mocked<AIService> = {
    generateAnswer: jest.fn(),
    generateResponse: jest.fn(),
    generateResponseStream: jest.fn(),
    generateExplanation: jest.fn(),
    evaluateResponse: jest.fn(),
  };
  return mock;
};

describe('RecipeAIService', () => {
  let aiService: jest.Mocked<AIService>;
  let service: RecipeAIService;

  beforeEach(() => {
    aiService = createMockAIService();
    service = new RecipeAIService(aiService);
  });

  describe('generateRecipeDraft', () => {
    const baseInput: GenerateRecipeDraftInput = {
      topic: 'Las vocales',
      learningObjectives: ['Aprender las vocales'],
      targetAgeMin: 5,
      targetAgeMax: 7,
    };

    it('should return GeneratedRecipeDraft when AI returns valid JSON', async () => {
      const aiResponse = JSON.stringify({
        title: 'Las vocales',
        description: 'Aprende las vocales',
        expectedDurationMinutes: 30,
        steps: [
          {
            order: 1,
            stepType: 'intro',
            title: 'Introducción',
            script: {
              transition: { text: 'Hola' },
              content: { text: 'Las vocales', chunks: [{ text: 'Vocales', pauseAfter: 500 }] },
              closure: { text: 'Fin' },
            },
          },
          {
            order: 2,
            stepType: 'content',
            title: 'Contenido',
            script: {
              transition: { text: 'Más' },
              content: { text: 'Más contenido', chunks: [{ text: 'Chunk', pauseAfter: 500 }] },
            },
          },
          {
            order: 3,
            stepType: 'closure',
            title: 'Cierre',
            script: {
              transition: { text: 'Adiós' },
              content: { text: 'Fin', chunks: [{ text: 'Fin', pauseAfter: 500 }] },
              closure: { text: 'Chao' },
            },
          },
        ],
        qualityValidation: { passed: true, errors: [], warnings: [] },
      });

      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result).toMatchObject({
        title: 'Las vocales',
        description: 'Aprende las vocales',
        expectedDurationMinutes: 30,
        qualityValidation: { passed: true, errors: [], warnings: [] },
      });
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].stepType).toBe('intro');
      expect(result.steps[0].title).toBe('Introducción');
      expect(result.steps[1].stepType).toBe('content');
      expect(result.steps[2].stepType).toBe('closure');
    });

    it('should fallback to default draft when AI returns invalid JSON', async () => {
      aiService.generateAnswer.mockResolvedValue({ answer: 'invalid json content' });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.title).toContain('Las vocales');
      expect(result.expectedDurationMinutes).toBeGreaterThan(0);
      expect(result.steps.length).toBeGreaterThanOrEqual(3);
      expect(result.qualityValidation).toBeDefined();
    });

    it('should fallback when AI throws an error', async () => {
      aiService.generateAnswer.mockRejectedValue(new Error('AI service unavailable'));

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.title).toContain('Las vocales');
      expect(result.steps.length).toBeGreaterThanOrEqual(3);
    });

    it('should sanitize missing title', async () => {
      const aiResponse = JSON.stringify({
        description: 'A description',
        expectedDurationMinutes: 20,
        steps: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.title).toBe(`Aprende sobre ${baseInput.topic}`);
    });

    it('should sanitize missing description', async () => {
      const aiResponse = JSON.stringify({
        title: 'My Title',
        expectedDurationMinutes: 20,
        steps: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.description).toBe(`Unidad sobre ${baseInput.topic}`);
    });

    it('should sanitize missing expectedDurationMinutes', async () => {
      const aiResponse = JSON.stringify({
        title: 'My Title',
        description: 'Desc',
        steps: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.expectedDurationMinutes).toBe(30); // default
    });

    it('should sanitize steps with invalid stepType and default to content', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [
          {
            order: 1,
            stepType: 'invalid' as any,
            title: 'Step1',
            script: { content: { text: 'c', chunks: [{ text: 'c', pauseAfter: 500 }] } },
          },
          {
            order: 2,
            stepType: 'content',
            title: 'Step2',
            script: { content: { text: 'c2', chunks: [{ text: 'c2', pauseAfter: 500 }] } },
          },
          {
            order: 3,
            stepType: 'content',
            title: 'Step3',
            script: { content: { text: 'c3', chunks: [{ text: 'c3', pauseAfter: 500 }] } },
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.steps[0].stepType).toBe('content'); // sanitized from 'invalid'
    });

    it('should sanitize steps with missing script and use default based on stepType', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [
          {
            order: 1,
            stepType: 'activity',
            title: 'Activity',
            script: null as any,
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      const activityStep = result.steps.find((s) => s.stepType === 'activity');
      expect(activityStep).toBeDefined();
      expect(activityStep!.script).toHaveProperty('kind', 'activity');
      expect(activityStep!.script).toHaveProperty('options');
    });

    it('should add fallback steps when fewer than 3 steps are provided', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [
          {
            order: 1,
            stepType: 'intro',
            title: 'Intro',
            script: { transition: { text: 'Hola' } },
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.steps.length).toBeGreaterThanOrEqual(3);
    });

    it('should validate activity script with missing options and add defaults', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [
          {
            order: 1,
            stepType: 'activity',
            title: 'Activity',
            script: {
              instruction: 'Do it',
            },
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      const activityStep = result.steps.find((s) => s.stepType === 'activity');
      expect(activityStep).toBeDefined();
      expect(activityStep!.script.kind).toBe('activity');
      expect(Array.isArray(activityStep!.script.options)).toBe(true);
      expect(activityStep!.script.options!.some((o) => o.isCorrect)).toBe(true);
    });

    it('should validate question script with missing expectedAnswer and feedback', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [
          {
            order: 1,
            stepType: 'question',
            title: 'Question',
            script: {
              question: 'What did you learn?',
            },
          },
        ],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      const questionStep = result.steps.find((s) => s.stepType === 'question');
      expect(questionStep).toBeDefined();
      expect(questionStep!.script.kind).toBe('question');
      expect(questionStep!.script.expectedAnswer).toBeDefined();
      expect(questionStep!.script.feedback).toHaveProperty('correct');
      expect(questionStep!.script.feedback).toHaveProperty('incorrect');
    });

    it('should preserve qualityValidation if provided with partial data', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [],
        qualityValidation: { passed: false, errors: ['Error1'], warnings: ['Warn1'] },
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.qualityValidation).toEqual({
        passed: false,
        errors: ['Error1'],
        warnings: ['Warn1'],
      });
    });

    it('should default qualityValidation to passed: true if missing', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.qualityValidation).toEqual({ passed: true, errors: [], warnings: [] });
    });

    it('should handle AI response with markdown code block', async () => {
      const json = JSON.stringify({
        title: 'Test',
        steps: [{ order: 1, stepType: 'intro', title: 'I', script: {} }],
      });
      const aiResponse = `\`\`\`json\n${json}\n\`\`\``;
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      expect(result.title).toBe('Test');
    });

    it('should use topic-specific fallback examples when available', async () => {
      const aiResponse = JSON.stringify({
        title: 'Las vocales',
        steps: [{ order: 1, stepType: 'intro', title: 'I', script: {} }],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft({ ...baseInput, topic: 'las vocales' });

      // Should have fallback steps with vocales-specific examples
      const hasVowelExample = result.steps.some((step) =>
        step.script.examples?.some(
          (ex) => ex.text.toLowerCase().includes('vocales') || ex.text.includes('MANZANA'),
        ),
      );
      expect(hasVowelExample).toBe(true);
    });

    it('should handle steps with null values and filter them out', async () => {
      const aiResponse = JSON.stringify({
        title: 'Test',
        steps: [{ order: 1, stepType: 'intro', title: 'I', script: {} }, null, undefined as any],
      });
      aiService.generateAnswer.mockResolvedValue({ answer: aiResponse });

      const result = await service.generateRecipeDraft(baseInput);

      // null/undefined steps should be filtered out, leaving 1 plus possibly fallback if <3
      const validSteps = result.steps.filter((s) => s !== null && s !== undefined);
      expect(validSteps.length).toBeGreaterThanOrEqual(1);
    });
  });
});
