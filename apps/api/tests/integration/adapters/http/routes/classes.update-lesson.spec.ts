/**
 * Integration Tests for Class Lesson Update Endpoint
 *
 * Tests PATCH /api/classes/:classId/lessons/:lessonId
 */

import request from 'supertest';

import { createClassRouter } from '@/infrastructure/adapters/http/routes/classes.js';
import type { ClassService } from '@/application/services/class.service.js';
import {
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  LessonNotFoundError,
} from '@/application/services/class.service.js';
import type { ClassEntity, ClassLessonEntity } from '@/domain/entities/class.entity.js';

// Mock factories for entities
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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// Mock ClassService with updateLesson
const createMockClassService = (): jest.Mocked<ClassService> => {
  const mockService = {
    createClass: jest.fn(),
    getClass: jest.fn(),
    updateClass: jest.fn(),
    deleteClass: jest.fn(),
    listClasses: jest.fn(),
    publishClass: jest.fn(),
    addLesson: jest.fn(),
    removeLesson: jest.fn(),
    reorderLessons: jest.fn(),
    updateLesson: jest.fn(),
  } as unknown as jest.Mocked<ClassService>;
  return mockService;
};

// Helper to create app with mocked auth
const createApp = (
  classService: jest.Mocked<ClassService>,
  user: { id: string; role: string } = { id: 'tutor-1', role: 'TEACHER' },
) => {
  const router = createClassRouter({ classService } as any);
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });
  app.use('/api/classes', router);
  return app;
};

describe('PATCH /api/classes/:id/lessons/:lessonId', () => {
  let classService: jest.Mocked<ClassService>;

  beforeEach(() => {
    classService = createMockClassService();
  });

  it('should update lesson and return updated entity', async () => {
    // Given
    const updatedLesson = {
      id: 'lesson-1',
      classId: 'class-1',
      order: 0,
      title: 'Updated Lesson',
      recipeId: 'recipe-123',
      duration: 45,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    classService.updateLesson.mockResolvedValue(updatedLesson as any);

    const app = createApp(classService);

    // When
    const response = await request(app).patch('/api/classes/class-1/lessons/lesson-1').send({
      title: 'Updated Lesson',
      recipeId: 'recipe-123',
      duration: 45,
    });

    // Then
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated Lesson');
    expect(response.body.recipeId).toBe('recipe-123');
    expect(response.body.duration).toBe(45);
  });

  it('should return 400 for invalid input', async () => {
    // Given
    const app = createApp(classService);

    // When
    const response = await request(app)
      .patch('/api/classes/class-1/lessons/lesson-1')
      .send({ duration: 'invalid' }); // Not a number

    // Then
    expect(response.status).toBe(400);
  });

  it('should return 404 when class not found', async () => {
    // Given
    classService.updateLesson.mockRejectedValue(new ClassNotFoundError('class-1'));

    const app = createApp(classService);

    // When
    const response = await request(app)
      .patch('/api/classes/class-1/lessons/lesson-1')
      .send({ title: 'Updated' });

    // Then
    expect(response.status).toBe(404);
  });

  it('should return 403 when user does not own class', async () => {
    // Given
    classService.updateLesson.mockRejectedValue(new ClassOwnershipError('class-1', 'tutor-1'));

    const app = createApp(classService);

    // When
    const response = await request(app)
      .patch('/api/classes/class-1/lessons/lesson-1')
      .send({ title: 'Updated' });

    // Then
    expect(response.status).toBe(403);
  });

  it('should return 409 when class is not DRAFT', async () => {
    // Given
    classService.updateLesson.mockRejectedValue(
      new ClassStateError('class-1', 'Cannot update lesson in class with status PUBLISHED'),
    );

    const app = createApp(classService);

    // When
    const response = await request(app)
      .patch('/api/classes/class-1/lessons/lesson-1')
      .send({ title: 'Updated' });

    // Then
    expect(response.status).toBe(409);
  });

  it('should return 404 when lesson not found', async () => {
    // Given
    classService.updateLesson.mockRejectedValue(new LessonNotFoundError('lesson-1'));

    const app = createApp(classService);

    // When
    const response = await request(app)
      .patch('/api/classes/class-1/lessons/non-existent')
      .send({ title: 'Updated' });

    // Then
    expect(response.status).toBe(404);
  });
});
