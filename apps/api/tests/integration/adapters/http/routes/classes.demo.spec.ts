/**
 * Integration Tests for Class Demo Endpoint
 *
 * Tests POST /api/classes/:id/demo endpoint
 */

import request from 'supertest';

import { createClassRouter } from '@/infrastructure/adapters/http/routes/classes.js';
import type { ClassEntity, ClassLessonEntity } from '@/domain/entities/class.entity.js';
import { ClassNotFoundError } from '@/application/services/class.service.js';

// Mock class entity factory
const createMockClass = (overrides: Partial<ClassEntity> = {}): ClassEntity => ({
  id: 'class-1',
  title: 'Test Class',
  description: 'Test Description',
  tutorId: 'tutor-1',
  status: 'DRAFT',
  version: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lessons: [],
  ...overrides,
});

const createMockLesson = (overrides: Partial<ClassLessonEntity> = {}): ClassLessonEntity => ({
  id: 'lesson-1',
  classId: 'class-1',
  order: 0,
  title: 'Test Lesson',
  recipeId: 'recipe-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// Helper to create app with mocked dependencies
const createApp = (
  classService: any,
  classLessonRepository: any,
  startRecipeUseCase: any,
  user: { id: string; role: string } = { id: 'tutor-1', role: 'TEACHER' },
) => {
  const router = createClassRouter({
    classService,
    classLessonRepository,
    startRecipeUseCase,
  });

  const express = require('express');
  const app = express();
  app.use(express.json());

  // Mock auth middleware
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });

  app.use('/api/classes', router);
  return app;
};

describe('POST /api/classes/:id/demo', () => {
  let classService: any;
  let classLessonRepository: any;
  let startRecipeUseCase: any;

  beforeEach(() => {
    // Reset mocks
    classService = {
      getClass: jest.fn(),
    };
    classLessonRepository = {
      findByClassId: jest.fn(),
    };
    startRecipeUseCase = {
      execute: jest.fn(),
    };
  });

  describe('Success scenarios', () => {
    it('should start demo session and return session data', async () => {
      // Given: class with lessons, first lesson has recipe
      const mockClass = createMockClass({
        id: 'class-1',
        tutorId: 'tutor-1',
        lessons: [
          createMockLesson({ id: 'lesson-1', recipeId: 'recipe-1', title: 'Lesson 1' }),
          createMockLesson({ id: 'lesson-2', recipeId: 'recipe-2', title: 'Lesson 2' }),
        ],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
      startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-demo-123' });

      const app = createApp(classService, classLessonRepository, startRecipeUseCase);

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        sessionId: 'session-demo-123',
        recipeId: 'recipe-1',
        title: 'Lesson 1',
      });

      // Verify calls
      expect(classService.getClass).toHaveBeenCalledWith('class-1');
      expect(classLessonRepository.findByClassId).toHaveBeenCalledWith('class-1');
      expect(startRecipeUseCase.execute).toHaveBeenCalledWith('recipe-1', 'tutor-1');
    });

    it('should allow ADMIN to access any class', async () => {
      // Given: class owned by another tutor
      const mockClass = createMockClass({
        id: 'class-1',
        tutorId: 'other-tutor',
        lessons: [createMockLesson({ recipeId: 'recipe-1' })],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
      startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-123' });

      const app = createApp(classService, classLessonRepository, startRecipeUseCase, {
        id: 'admin-1',
        role: 'ADMIN',
      });

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(200);
    });
  });

  describe('Authentication & Authorization errors', () => {
    it('should return 401 when user not authenticated', async () => {
      // Given: unauthenticated user
      const app = createApp(classService, classLessonRepository, startRecipeUseCase, {
        id: '',
        role: '',
      } as any);

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 403 when non-owner TEACHER attempts access', async () => {
      // Given: class owned by different tutor
      const mockClass = createMockClass({
        id: 'class-1',
        tutorId: 'other-tutor',
        lessons: [createMockLesson({ recipeId: 'recipe-1' })],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
      startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-123' });

      const app = createApp(classService, classLessonRepository, startRecipeUseCase, {
        id: 'tutor-2',
        role: 'TEACHER',
      });

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('does not have permission');
    });
  });

  describe('Business logic errors', () => {
    it('should return 404 when class not found', async () => {
      // Given: class does not exist
      classService.getClass.mockRejectedValue(new ClassNotFoundError('non-existent'));

      const app = createApp(classService, classLessonRepository, startRecipeUseCase);

      // When
      const response = await request(app).post('/api/classes/non-existent/demo');

      // Then
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Class not found: non-existent');
    });

    it('should return 400 when class has no lessons', async () => {
      // Given: class exists but has no lessons
      const mockClass = createMockClass({
        id: 'class-1',
        lessons: [],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue([]);

      const app = createApp(classService, classLessonRepository, startRecipeUseCase);

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Class has no lessons');
    });

    it('should return 400 when no lesson has recipeId', async () => {
      // Given: class has lessons but none with recipeId
      const mockClass = createMockClass({
        id: 'class-1',
        lessons: [
          createMockLesson({ recipeId: undefined }),
          createMockLesson({ recipeId: undefined }),
        ],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);

      const app = createApp(classService, classLessonRepository, startRecipeUseCase);

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No lesson with associated recipe found');
    });

    it('should select first lesson with recipeId when multiple exist', async () => {
      // Given: multiple lessons, only second has recipe (first lesson without recipe should be skipped)
      const mockClass = createMockClass({
        id: 'class-1',
        tutorId: 'tutor-1',
        lessons: [
          createMockLesson({ id: 'lesson-1', recipeId: undefined, title: 'No Recipe' }),
          createMockLesson({ id: 'lesson-2', recipeId: 'recipe-2', title: 'Lesson 2' }),
          createMockLesson({ id: 'lesson-3', recipeId: 'recipe-3', title: 'Lesson 3' }),
        ],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
      startRecipeUseCase.execute.mockResolvedValue({ sessionId: 'session-123' });

      const app = createApp(classService, classLessonRepository, startRecipeUseCase);

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        sessionId: 'session-123',
        recipeId: 'recipe-2',
        title: 'Lesson 2',
      });
      // Should have called startRecipeUseCase with the first lesson that has a recipe
      expect(startRecipeUseCase.execute).toHaveBeenCalledWith('recipe-2', 'tutor-1');
    });
  });

  describe('Server errors', () => {
    it('should return 500 when startRecipeUseCase throws', async () => {
      // Given: valid class and lesson, but startRecipeUseCase fails
      const mockClass = createMockClass({
        id: 'class-1',
        lessons: [createMockLesson({ recipeId: 'recipe-1' })],
      });
      classService.getClass.mockResolvedValue(mockClass);
      classLessonRepository.findByClassId.mockResolvedValue(mockClass.lessons);
      startRecipeUseCase.execute.mockRejectedValue(new Error('Recipe start failed'));

      const app = createApp(classService, classLessonRepository, startRecipeUseCase);

      // When
      const response = await request(app).post('/api/classes/class-1/demo');

      // Then
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Recipe start failed');
    });
  });
});
