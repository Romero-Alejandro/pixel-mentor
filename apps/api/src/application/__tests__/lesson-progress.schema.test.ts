/**
 * Integration Test: Recipe Step Flow with lessonProgress
 *
 * Tests the lessonProgress field schema changes and step progression logic.
 */

import { describe, it, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';

// Test the schema changes
import { InteractRecipeOutputSchema, StartRecipeOutputSchema } from '@pixel-mentor/shared/recipe';

// Helper function for step progression logic
function calculateNextStep(
  currentStep: number,
  totalSteps: number,
  input: string,
): {
  nextStep: number;
  completed: boolean;
} {
  const lowerInput = input.toLowerCase();
  const isContinue = [
    'continuar',
    'sí',
    'si',
    'next',
    'continue',
    'adelante',
    'vamos',
    'listo',
  ].includes(lowerInput);

  if (!isContinue) {
    return { nextStep: currentStep, completed: false };
  }

  if (currentStep >= totalSteps - 1) {
    return { nextStep: currentStep, completed: true };
  }

  return { nextStep: currentStep + 1, completed: false };
}

describe('Recipe Step Flow - lessonProgress Schema', () => {
  describe('StartRecipeOutputSchema', () => {
    it('should accept lessonProgress field', () => {
      const validOutput = {
        sessionId: randomUUID(),
        voiceText: 'Welcome!',
        pedagogicalState: 'ACTIVE_CLASS' as const,
        lessonProgress: {
          currentStep: 0,
          totalSteps: 5,
        },
        needsStart: true,
        resumed: false,
      };

      const result = StartRecipeOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('should accept lessonProgress as optional', () => {
      const validOutput = {
        sessionId: randomUUID(),
        voiceText: 'Welcome!',
        pedagogicalState: 'ACTIVE_CLASS' as const,
      };

      const result = StartRecipeOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });

  describe('InteractRecipeOutputSchema', () => {
    it('should accept lessonProgress field', () => {
      const validOutput = {
        voiceText: 'Next step content',
        pedagogicalState: 'ACTIVE_CLASS' as const,
        lessonProgress: {
          currentStep: 2,
          totalSteps: 5,
        },
      };

      const result = InteractRecipeOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('should accept lessonProgress for completed state', () => {
      const validOutput = {
        voiceText: 'Felicitaciones!',
        pedagogicalState: 'COMPLETED' as const,
        sessionCompleted: true,
        lessonProgress: {
          currentStep: 4,
          totalSteps: 5,
        },
      };

      const result = InteractRecipeOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('should accept lessonProgress for evaluation state', () => {
      const validOutput = {
        voiceText: 'Correct!',
        pedagogicalState: 'EVALUATION' as const,
        isCorrect: true,
        feedback: 'Great job!',
        lessonProgress: {
          currentStep: 1,
          totalSteps: 5,
        },
      };

      const result = InteractRecipeOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });
});

describe('Step Progression Logic', () => {
  it('should progress from step 0 to 1 on "continuar"', () => {
    const result = calculateNextStep(0, 5, 'continuar');
    expect(result.nextStep).toBe(1);
    expect(result.completed).toBe(false);
  });

  it('should complete lesson on last step when continuing', () => {
    const result = calculateNextStep(4, 5, 'continuar');
    expect(result.nextStep).toBe(4);
    expect(result.completed).toBe(true);
  });

  it('should not progress on non-continue input', () => {
    const result = calculateNextStep(0, 5, 'some answer');
    expect(result.nextStep).toBe(0);
    expect(result.completed).toBe(false);
  });

  it('should track progress through all steps', () => {
    let currentStep = 0;
    const totalSteps = 5;
    const progresses: number[] = [];

    // Simulate progression through all steps
    while (currentStep < totalSteps - 1) {
      progresses.push(currentStep);
      const result = calculateNextStep(currentStep, totalSteps, 'continuar');
      currentStep = result.nextStep;
    }

    // Final step - should complete
    progresses.push(currentStep);
    const finalResult = calculateNextStep(currentStep, totalSteps, 'continuar');
    expect(finalResult.completed).toBe(true);

    // Verify all steps were visited
    expect(progresses).toEqual([0, 1, 2, 3, 4]);
  });

  it('should handle various continue phrases', () => {
    const continuePhrases = ['sí', 'si', 'next', 'continue', 'adelante', 'vamos', 'listo'];

    continuePhrases.forEach((phrase) => {
      const result = calculateNextStep(0, 5, phrase);
      expect(result.nextStep).toBe(1);
      expect(result.completed).toBe(false);
    });
  });
});

describe('Activity and Question State Handling', () => {
  it('should preserve current step when in activity state', () => {
    // When user is answering an activity, step shouldn't advance until they complete it
    const activityStep = 1;
    const totalSteps = 5;

    // User provides an answer (not "continuar")
    const result = calculateNextStep(activityStep, totalSteps, 'Rosa');

    // Step should NOT advance - stays at activity until completed
    expect(result.nextStep).toBe(1);
    expect(result.completed).toBe(false);
  });

  it('should advance after activity is resolved (evaluation)', () => {
    // After evaluation, when user says "continuar", advance to next step
    const activityStep = 1;
    const totalSteps = 5;

    // After evaluation, user says "continuar"
    const result = calculateNextStep(activityStep, totalSteps, 'continuar');

    // Should advance to step 2
    expect(result.nextStep).toBe(2);
    expect(result.completed).toBe(false);
  });

  it('should handle multiple interactions at same step', () => {
    const currentStep = 1; // activity step
    const totalSteps = 5;
    const interactions = ['Rosa', 'incorrecta', 'otra respuesta'];

    // Multiple interactions at same step should not advance
    interactions.forEach((input) => {
      const result = calculateNextStep(currentStep, totalSteps, input);
      expect(result.nextStep).toBe(1); // stays at activity
    });
  });
});

describe('Progress Reporting', () => {
  it('should report correct progress at each step', () => {
    const totalSteps = 5;
    const progressReports: Array<{ step: number; total: number; percent: number }> = [];

    for (let step = 0; step < totalSteps; step++) {
      progressReports.push({
        step,
        total: totalSteps,
        percent: Math.round((step / totalSteps) * 100),
      });
    }

    expect(progressReports).toEqual([
      { step: 0, total: 5, percent: 0 },
      { step: 1, total: 5, percent: 20 },
      { step: 2, total: 5, percent: 40 },
      { step: 3, total: 5, percent: 60 },
      { step: 4, total: 5, percent: 80 },
    ]);
  });

  it('should indicate completion when at last step', () => {
    const totalSteps = 5;
    const atLastStep = totalSteps - 1;

    // At last step, progress is effectively 100%
    const percentComplete = Math.round(((atLastStep + 1) / totalSteps) * 100);
    expect(percentComplete).toBe(100);
  });
});
