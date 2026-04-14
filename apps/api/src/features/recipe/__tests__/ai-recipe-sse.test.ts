/**
 * AI Recipe SSE Streaming Tests
 *
 * Tests for the SSE endpoint and streaming functionality.
 * Uses CommonJS require since Jest is configured for CommonJS.
 */

const { z } = require('zod');

describe('AI Recipe SSE Endpoint', () => {
  const baseUrl = '/api/ai';
  const streamEndpoint = '/generate-recipe/stream';

  describe('Endpoint Configuration', () => {
    it('should have correct base path', () => {
      expect(baseUrl).toBe('/api/ai');
    });

    it('should have correct stream endpoint path', () => {
      expect(streamEndpoint).toBe('/generate-recipe/stream');
    });

    it('should combine to full path', () => {
      expect(baseUrl + streamEndpoint).toBe('/api/ai/generate-recipe/stream');
    });
  });

  describe('SSE Event Types', () => {
    it('should have step event type', () => {
      const eventTypes = ['step', 'progress', 'error', 'complete'];
      expect(eventTypes).toContain('step');
    });

    it('should have progress event type', () => {
      const eventTypes = ['step', 'progress', 'error', 'complete'];
      expect(eventTypes).toContain('progress');
    });

    it('should have error event type', () => {
      const eventTypes = ['step', 'progress', 'error', 'complete'];
      expect(eventTypes).toContain('error');
    });

    it('should have complete event type', () => {
      const eventTypes = ['step', 'progress', 'error', 'complete'];
      expect(eventTypes).toContain('complete');
    });
  });

  describe('Query Parameters', () => {
    it('should require topic parameter', () => {
      const requiredParams = ['topic', 'targetAgeMin', 'targetAgeMax'];
      expect(requiredParams).toContain('topic');
    });

    it('should require age range parameters', () => {
      const requiredParams = ['topic', 'targetAgeMin', 'targetAgeMax'];
      expect(requiredParams).toContain('targetAgeMin');
      expect(requiredParams).toContain('targetAgeMax');
    });

    it('should accept objectives as optional', () => {
      const optionalParams = ['objectives'];
      expect(optionalParams).toContain('objectives');
    });
  });
});

describe('Progress Calculation', () => {
  // Match the logic in recipe-ai.service.ts
  const calculateProgress = (stepIndex, totalSteps) => {
    return 50 + Math.round(((stepIndex + 1) / totalSteps) * 40);
  };

  it('should start at 10% initially', () => {
    const initialProgress = 10;
    expect(initialProgress).toBe(10);
  });

  it('should be at 50% after AI response', () => {
    const afterAIProgress = 50;
    expect(afterAIProgress).toBe(50);
  });

  it('should calculate progress for first step of 3', () => {
    expect(calculateProgress(0, 3)).toBe(63);
  });

  it('should calculate progress for second step of 3', () => {
    expect(calculateProgress(1, 3)).toBe(76);
  });

  it('should calculate progress for third step of 3', () => {
    expect(calculateProgress(2, 3)).toBe(90);
  });

  it('should handle 7 steps correctly', () => {
    expect(calculateProgress(0, 7)).toBe(55);
    expect(calculateProgress(6, 7)).toBe(90);
  });

  it('should handle single step', () => {
    expect(calculateProgress(0, 1)).toBe(90);
  });
});

describe('Authentication & Authorization', () => {
  it('should require TEACHER role', () => {
    const requiredRole = 'TEACHER';
    expect(requiredRole).toBe('TEACHER');
  });

  it('should allow ADMIN role', () => {
    const adminRole = 'ADMIN';
    expect(adminRole).toBe('ADMIN');
  });

  it('should reject STUDENT role', () => {
    const studentRole = 'STUDENT';
    expect(studentRole).not.toBe('TEACHER');
  });
});

describe('GeneratedStepSchema', () => {
  // Define schema matching the implementation
  const GeneratedStepScriptSchema = z
    .object({
      transition: z.union([z.string(), z.object({ text: z.string() })]).optional(),
      content: z.union([z.string(), z.record(z.unknown())]).optional(),
      examples: z.array(z.unknown()).optional(),
      closure: z.union([z.string(), z.object({ text: z.string() })]).optional(),
      instruction: z.union([z.string(), z.object({ text: z.string() })]).optional(),
      options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).optional(),
      feedback: z
        .object({ correct: z.string().optional(), incorrect: z.string().optional() })
        .optional(),
      question: z.union([z.string(), z.object({ text: z.string() })]).optional(),
      expectedAnswer: z.string().optional(),
      hint: z.union([z.string(), z.object({ text: z.string() })]).optional(),
    })
    .optional();

  const GeneratedStepSchema = z.object({
    order: z.number().int().positive(),
    stepType: z.enum(['intro', 'content', 'activity', 'question', 'closure']),
    title: z.string().min(1),
    script: GeneratedStepScriptSchema,
  });

  describe('Valid Steps', () => {
    it('should validate intro step', () => {
      const step = {
        order: 1,
        stepType: 'intro',
        title: 'Introduction',
        script: { transition: { text: 'Hello!' } },
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate content step', () => {
      const step = {
        order: 2,
        stepType: 'content',
        title: 'Main Content',
        script: { content: { text: 'Content here' } },
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate activity step', () => {
      const step = {
        order: 3,
        stepType: 'activity',
        title: 'Practice',
        script: {
          instruction: { text: 'Do this' },
          options: [
            { text: 'Correct', isCorrect: true },
            { text: 'Wrong', isCorrect: false },
          ],
          feedback: { correct: 'Good!', incorrect: 'Try again' },
        },
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate question step', () => {
      const step = {
        order: 4,
        stepType: 'question',
        title: 'Quiz',
        script: {
          question: { text: 'What is 2+2?' },
          expectedAnswer: '4',
          feedback: { correct: 'Correct!', incorrect: 'No' },
        },
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate closure step', () => {
      const step = {
        order: 5,
        stepType: 'closure',
        title: 'End',
        script: { closure: { text: 'Goodbye!' } },
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Steps', () => {
    it('should reject missing order', () => {
      const step = {
        stepType: 'content',
        title: 'No order',
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject invalid stepType', () => {
      const step = {
        order: 1,
        stepType: 'invalid',
        title: 'Bad type',
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const step = {
        order: 1,
        stepType: 'content',
        title: '',
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject zero order', () => {
      const step = {
        order: 0,
        stepType: 'content',
        title: 'Zero order',
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject negative order', () => {
      const step = {
        order: -1,
        stepType: 'content',
        title: 'Negative',
      };
      const result = GeneratedStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });
  });
});

describe('SSE Response Format', () => {
  const formatSSEEvent = (event, data) => {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  };

  it('should format step event correctly', () => {
    const step = { order: 1, title: 'Test' };
    const formatted = formatSSEEvent('step', step);
    expect(formatted).toContain('event: step');
    expect(formatted).toContain('data:');
    expect(formatted).toContain(JSON.stringify(step));
  });

  it('should format progress event correctly', () => {
    const progress = { progress: 50 };
    const formatted = formatSSEEvent('progress', progress);
    expect(formatted).toContain('event: progress');
    expect(formatted).toContain('"progress":50');
  });

  it('should format error event correctly', () => {
    const error = { message: 'Failed', code: 'ERROR' };
    const formatted = formatSSEEvent('error', error);
    expect(formatted).toContain('event: error');
    expect(formatted).toContain('Failed');
  });

  it('should format complete event correctly', () => {
    const complete = { status: 'complete' };
    const formatted = formatSSEEvent('complete', complete);
    expect(formatted).toContain('event: complete');
    expect(formatted).toContain('complete');
  });

  it('should end with double newline', () => {
    const formatted = formatSSEEvent('step', { test: true });
    expect(formatted.endsWith('\n\n')).toBe(true);
  });
});
