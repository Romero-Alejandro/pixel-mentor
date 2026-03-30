/**
 * Integration Tests for Class API Routes
 *
 * Tests cover all HTTP endpoints:
 * - POST /api/classes → 201, returns class
 * - GET /api/classes → list with pagination
 * - GET /api/classes/:id → returns class with lessons
 * - PATCH /api/classes/:id → updates title/description
 * - DELETE /api/classes/:id → deletes DRAFT, 409 for non-DRAFT
 * - POST /api/classes/:id/publish → publishes class, validates lessons
 * - POST /api/classes/:id/lessons → adds lesson, returns lesson entity
 * - DELETE /api/classes/:id/lessons/:lessonId → 204, removes from class
 * - PATCH /api/classes/:id/lessons/reorder → 200 with {message}, lessons reordered
 */

import request from 'supertest';

import { createClassRouter } from '@/infrastructure/adapters/http/routes/classes.js';
import type { ClassService } from '@/application/services/class.service.js';
import {
  ClassNotFoundError,
  ClassOwnershipError,
  ClassStateError,
  ClassValidationError,
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
  recipeId: 'recipe-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  recipe: {
    id: 'recipe-1',
    title: 'Test Lesson',
    expectedDurationMinutes: 30,
  },
  ...overrides,
});

// Mock ClassService
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
  } as unknown as jest.Mocked<ClassService>;
  return mockService;
};

// Helper to create app with mocked auth
const createApp = (
  classService: jest.Mocked<ClassService>,
  user: { id: string; role: string } = { id: 'tutor-1', role: 'TEACHER' },
) => {
  // Create router with only classService (demo endpoint requires additional deps but not tested here)
  const router = createClassRouter({ classService } as any);

  // Wrap in Express app with mock auth middleware
  const express = require('express');
  const app = express();

  // Add body parser middleware
  app.use(express.json());

  // Mock auth middleware
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });

  app.use('/api/classes', router);

  return app;
};

describe('Classes API Routes', () => {
  let classService: jest.Mocked<ClassService>;

  beforeEach(() => {
    classService = createMockClassService();
  });

  describe('POST /api/classes', () => {
    it('should create a new class and return 201', async () => {
      // Given
      const mockClass = createMockClass({ id: 'class-new', title: 'New Class' });
      classService.createClass.mockResolvedValue(mockClass);

      const app = createApp(classService);

      // When
      const response = await request(app).post('/api/classes').send({
        title: 'New Class',
        description: 'Class Description',
      });

      // Then
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 'class-new');
      expect(response.body.title).toBe('New Class');
    });

    it('should return 400 for invalid input', async () => {
      // Given
      const app = createApp(classService);

      // When
      const response = await request(app).post('/api/classes').send({}); // Missing title

      // Then
      expect(response.status).toBe(400);
    });

    it('should return 401 when user not authenticated', async () => {
      // Given
      const app = createApp(classService, { id: '', role: '' } as any);

      // When
      const response = await request(app).post('/api/classes').send({ title: 'Test' });

      // Then
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/classes', () => {
    it('should list classes with pagination', async () => {
      // Given
      const mockClasses = [createMockClass({ id: 'class-1' }), createMockClass({ id: 'class-2' })];
      classService.listClasses.mockResolvedValue({
        classes: mockClasses,
        total: 2,
        page: 1,
        limit: 20,
      });

      const app = createApp(classService);

      // When
      const response = await request(app).get('/api/classes');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.classes).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should filter by status', async () => {
      // Given
      classService.listClasses.mockResolvedValue({
        classes: [createMockClass({ status: 'DRAFT' })],
        total: 1,
        page: 1,
        limit: 20,
      });

      const app = createApp(classService);

      // When
      const response = await request(app).get('/api/classes?status=DRAFT');

      // Then
      expect(response.status).toBe(200);
      expect(classService.listClasses).toHaveBeenCalledWith('tutor-1', {
        status: 'DRAFT',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('GET /api/classes/:id', () => {
    it('should return class with lessons', async () => {
      // Given
      const mockClass = createMockClass({
        id: 'class-1',
        lessons: [createMockLesson({ id: 'lesson-1' })],
      });
      classService.getClass.mockResolvedValue(mockClass as any);

      const app = createApp(classService);

      // When
      const response = await request(app).get('/api/classes/class-1');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('class-1');
      expect(response.body.lessons).toHaveLength(1);
    });

    it('should return 404 when class not found', async () => {
      // Given
      classService.getClass.mockRejectedValue(new ClassNotFoundError('class-1'));

      const app = createApp(classService);

      // When
      const response = await request(app).get('/api/classes/non-existent');

      // Then
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/classes/:id', () => {
    it('should update title and description', async () => {
      // Given
      const updatedClass = createMockClass({
        id: 'class-1',
        title: 'Updated Title',
        description: 'Updated Description',
      });
      classService.updateClass.mockResolvedValue(updatedClass);

      const app = createApp(classService);

      // When
      const response = await request(app).patch('/api/classes/class-1').send({
        title: 'Updated Title',
        description: 'Updated Description',
      });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should return 404 when class not found', async () => {
      // Given
      classService.updateClass.mockRejectedValue(new ClassNotFoundError('class-1'));

      const app = createApp(classService);

      // When
      const response = await request(app)
        .patch('/api/classes/non-existent')
        .send({ title: 'New Title' });

      // Then
      expect(response.status).toBe(404);
    });

    it('should return 403 when user does not own class', async () => {
      // Given
      classService.updateClass.mockRejectedValue(new ClassOwnershipError('class-1', 'other-tutor'));

      const app = createApp(classService);

      // When
      const response = await request(app)
        .patch('/api/classes/class-1')
        .send({ title: 'New Title' });

      // Then
      expect(response.status).toBe(403);
    });

    it('should return 409 for non-DRAFT class', async () => {
      // Given
      classService.updateClass.mockRejectedValue(
        new ClassStateError('class-1', 'Cannot update class in status PUBLISHED'),
      );

      const app = createApp(classService);

      // When
      const response = await request(app)
        .patch('/api/classes/class-1')
        .send({ title: 'New Title' });

      // Then
      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/classes/:id', () => {
    it('should delete DRAFT class', async () => {
      // Given
      classService.deleteClass.mockResolvedValue();

      const app = createApp(classService);

      // When
      const response = await request(app).delete('/api/classes/class-1');

      // Then
      expect(response.status).toBe(204);
    });

    it('should return 409 for non-DRAFT class', async () => {
      // Given
      classService.deleteClass.mockRejectedValue(
        new ClassStateError('class-1', 'Cannot delete class in status PUBLISHED'),
      );

      const app = createApp(classService);

      // When
      const response = await request(app).delete('/api/classes/class-1');

      // Then
      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/classes/:id/publish', () => {
    it('should publish class and return updated class', async () => {
      // Given
      const publishedClass = createMockClass({
        id: 'class-1',
        status: 'PUBLISHED',
        version: 1,
      });
      classService.publishClass.mockResolvedValue(publishedClass);

      const app = createApp(classService);

      // When
      const response = await request(app).post('/api/classes/class-1/publish');

      // Then
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('PUBLISHED');
      expect(response.body.version).toBe(1);
    });

    it('should return 422 when class has no lessons', async () => {
      // Given
      classService.publishClass.mockRejectedValue(
        new ClassValidationError('Class must have at least 1 lesson before publishing'),
      );

      const app = createApp(classService);

      // When
      const response = await request(app).post('/api/classes/class-1/publish');

      // Then
      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/classes/:id/lessons', () => {
    it('should add lesson and return lesson entity', async () => {
      // Given
      const newLesson = createMockLesson({
        id: 'lesson-new',
        recipe: { id: 'recipe-1', title: 'New Lesson', expectedDurationMinutes: 30 },
      });
      classService.addLesson.mockResolvedValue(newLesson);

      const app = createApp(classService);

      // When
      const response = await request(app).post('/api/classes/class-1/lessons').send({
        recipeId: 'recipe-1',
      });

      // Then
      expect(response.status).toBe(201);
      expect(response.body.id).toBe('lesson-new');
    });

    it('should return 409 for non-DRAFT class', async () => {
      // Given
      classService.addLesson.mockRejectedValue(
        new ClassStateError('class-1', 'Cannot add lesson to class in status PUBLISHED'),
      );

      const app = createApp(classService);

      // When
      const response = await request(app)
        .post('/api/classes/class-1/lessons')
        .send({ recipeId: 'recipe-1' });

      // Then
      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/classes/:id/lessons/:lessonId', () => {
    it('should remove lesson and return 204', async () => {
      // Given
      classService.removeLesson.mockResolvedValue();

      const app = createApp(classService);

      // When
      const response = await request(app).delete('/api/classes/class-1/lessons/lesson-1');

      // Then
      expect(response.status).toBe(204);
    });

    it('should return 404 when lesson not found', async () => {
      // Given
      classService.removeLesson.mockRejectedValue(new LessonNotFoundError('lesson-1'));

      const app = createApp(classService);

      // When
      const response = await request(app).delete('/api/classes/class-1/lessons/non-existent');

      // Then
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/classes/:id/lessons/reorder', () => {
    it('should reorder lessons and return success message', async () => {
      // Given
      classService.reorderLessons.mockResolvedValue();

      const app = createApp(classService);

      // When
      const response = await request(app)
        .patch('/api/classes/class-1/lessons/reorder')
        .send({
          lessonIds: ['lesson-2', 'lesson-1'],
        });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Lessons reordered successfully');
    });

    it('should return 400 for invalid input', async () => {
      // Given
      const app = createApp(classService);

      // When
      const response = await request(app).patch('/api/classes/class-1/lessons/reorder').send({}); // Missing lessonIds

      // Then
      expect(response.status).toBe(400);
    });

    it('should return 404 when lesson not found', async () => {
      // Given
      classService.reorderLessons.mockRejectedValue(new LessonNotFoundError('lesson-1'));

      const app = createApp(classService);

      // When
      const response = await request(app)
        .patch('/api/classes/class-1/lessons/reorder')
        .send({ lessonIds: ['non-existent'] });

      // Then
      expect(response.status).toBe(404);
    });

    it('should return 409 for non-DRAFT class', async () => {
      // Given
      classService.reorderLessons.mockRejectedValue(
        new ClassStateError('class-1', 'Cannot reorder lessons in class in status PUBLISHED'),
      );

      const app = createApp(classService);

      // When
      const response = await request(app)
        .patch('/api/classes/class-1/lessons/reorder')
        .send({ lessonIds: ['lesson-1'] });

      // Then
      expect(response.status).toBe(409);
    });
  });

  describe('Authorization', () => {
    it('should allow TEACHER to access their classes', async () => {
      // Given
      const mockClass = createMockClass({ id: 'class-1', tutorId: 'tutor-1' });
      classService.getClass.mockResolvedValue(mockClass as any);

      const app = createApp(classService, { id: 'tutor-1', role: 'TEACHER' });

      // When
      const response = await request(app).get('/api/classes/class-1');

      // Then
      expect(response.status).toBe(200);
    });

    it('should allow ADMIN to access any class', async () => {
      // Given
      const mockClass = createMockClass({ id: 'class-1', tutorId: 'other-tutor' });
      classService.getClass.mockResolvedValue(mockClass as any);

      const app = createApp(classService, { id: 'admin-1', role: 'ADMIN' });

      // When
      const response = await request(app).get('/api/classes/class-1');

      // Then
      expect(response.status).toBe(200);
    });

    it('should forbid non-owner TEACHER from accessing class', async () => {
      // Given
      const mockClass = createMockClass({ id: 'class-1', tutorId: 'other-tutor' });
      classService.getClass.mockResolvedValue(mockClass as any);

      const app = createApp(classService, { id: 'tutor-2', role: 'TEACHER' });

      // When
      const response = await request(app).get('/api/classes/class-1');

      // Then
      expect(response.status).toBe(403);
    });
  });
});
