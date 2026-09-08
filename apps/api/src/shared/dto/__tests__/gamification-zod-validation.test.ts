/**
 * Unit Tests for Gamification Zod Validation Schemas
 */

import { z } from 'zod';

const ActivitySchema = z.object({
  type: z.enum(['LESSON_COMPLETED', 'ACTIVITY_ATTEMPT', 'DAILY_LOGIN']),
  payload: z
    .object({
      lessonId: z.string().optional(),
      lessonTitle: z.string().optional(),
      activityId: z.string().optional(),
      correct: z.boolean().optional(),
      attemptNumber: z.number().int().positive().optional(),
      hintUsed: z.boolean().optional(),
    })
    .optional(),
});

describe('Gamification Zod Validation', () => {
  describe('ActivitySchema', () => {
    describe('type field', () => {
      it('should accept LESSON_COMPLETED', () => {
        const result = ActivitySchema.safeParse({ type: 'LESSON_COMPLETED' });
        expect(result.success).toBe(true);
      });

      it('should accept ACTIVITY_ATTEMPT', () => {
        const result = ActivitySchema.safeParse({ type: 'ACTIVITY_ATTEMPT' });
        expect(result.success).toBe(true);
      });

      it('should accept DAILY_LOGIN', () => {
        const result = ActivitySchema.safeParse({ type: 'DAILY_LOGIN' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid type', () => {
        const result = ActivitySchema.safeParse({ type: 'INVALID_TYPE' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('type');
        }
      });

      it('should reject missing type', () => {
        const result = ActivitySchema.safeParse({});
        expect(result.success).toBe(false);
      });
    });

    describe('payload field', () => {
      it('should accept empty payload', () => {
        const result = ActivitySchema.safeParse({ type: 'DAILY_LOGIN', payload: {} });
        expect(result.success).toBe(true);
      });

      it('should accept payload with lessonId', () => {
        const result = ActivitySchema.safeParse({
          type: 'LESSON_COMPLETED',
          payload: { lessonId: 'lesson-123' },
        });
        expect(result.success).toBe(true);
      });

      it('should reject negative attemptNumber', () => {
        const result = ActivitySchema.safeParse({
          type: 'ACTIVITY_ATTEMPT',
          payload: { attemptNumber: -1 },
        });
        expect(result.success).toBe(false);
      });

      it('should reject zero attemptNumber', () => {
        const result = ActivitySchema.safeParse({
          type: 'ACTIVITY_ATTEMPT',
          payload: { attemptNumber: 0 },
        });
        expect(result.success).toBe(false);
      });

      it('should reject non-integer attemptNumber', () => {
        const result = ActivitySchema.safeParse({
          type: 'ACTIVITY_ATTEMPT',
          payload: { attemptNumber: 1.5 },
        });
        expect(result.success).toBe(false);
      });

      it('should accept all payload fields', () => {
        const result = ActivitySchema.safeParse({
          type: 'ACTIVITY_ATTEMPT',
          payload: {
            lessonId: 'lesson-1',
            lessonTitle: 'Test Lesson',
            activityId: 'activity-1',
            correct: true,
            attemptNumber: 3,
            hintUsed: false,
          },
        });
        expect(result.success).toBe(true);
      });

      it('should reject wrong field types in payload', () => {
        const result = ActivitySchema.safeParse({
          type: 'LESSON_COMPLETED',
          payload: { lessonId: 123 },
        });
        expect(result.success).toBe(false);
      });
    });

    describe('complete validation', () => {
      it('should accept valid LESSON_COMPLETED payload', () => {
        const result = ActivitySchema.safeParse({
          type: 'LESSON_COMPLETED',
          payload: { lessonId: 'abc', lessonTitle: 'Test' },
        });
        expect(result.success).toBe(true);
      });

      it('should accept valid ACTIVITY_ATTEMPT payload', () => {
        const result = ActivitySchema.safeParse({
          type: 'ACTIVITY_ATTEMPT',
          payload: { activityId: 'xyz', correct: true, attemptNumber: 1 },
        });
        expect(result.success).toBe(true);
      });

      it('should accept valid DAILY_LOGIN payload', () => {
        const result = ActivitySchema.safeParse({ type: 'DAILY_LOGIN' });
        expect(result.success).toBe(true);
      });
    });
  });
});
