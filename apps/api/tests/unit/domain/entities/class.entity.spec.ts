/**
 * Unit Tests for Class Entity - State Machine and Authorization Functions
 *
 * Tests cover:
 * - isValidStatusTransition: valid and invalid transitions
 * - getValidTransitions: returns correct array for each status
 * - transitionStatus: throws for invalid transitions, returns new status for valid
 * - canEditClass: role-based editing permissions
 * - canPublishClass: role-based publishing permissions
 * - canDeleteClass: role-based deletion permissions
 */

import {
  isValidStatusTransition,
  getValidTransitions,
  transitionStatus,
  canEditClass,
  canPublishClass,
  canDeleteClass,
  createClassEntity,
  createClassLessonEntity,
  createClassVersionEntity,
} from '@/domain/entities/class.entity';

describe('Class Entity - State Machine', () => {
  describe('isValidStatusTransition', () => {
    // Valid transitions
    describe('valid transitions', () => {
      it('should allow DRAFT -> UNDER_REVIEW', () => {
        expect(isValidStatusTransition('DRAFT', 'UNDER_REVIEW')).toBe(true);
      });

      it('should allow UNDER_REVIEW -> DRAFT', () => {
        expect(isValidStatusTransition('UNDER_REVIEW', 'DRAFT')).toBe(true);
      });

      it('should allow UNDER_REVIEW -> PUBLISHED', () => {
        expect(isValidStatusTransition('UNDER_REVIEW', 'PUBLISHED')).toBe(true);
      });

      it('should allow PUBLISHED -> ARCHIVED', () => {
        expect(isValidStatusTransition('PUBLISHED', 'ARCHIVED')).toBe(true);
      });

      it('should allow ARCHIVED -> PUBLISHED', () => {
        expect(isValidStatusTransition('ARCHIVED', 'PUBLISHED')).toBe(true);
      });

      it('should allow DRAFT -> PUBLISHED', () => {
        expect(isValidStatusTransition('DRAFT', 'PUBLISHED')).toBe(true);
      });

      it('should allow PUBLISHED -> DRAFT', () => {
        expect(isValidStatusTransition('PUBLISHED', 'DRAFT')).toBe(true);
      });
    });

    // Invalid transitions
    describe('invalid transitions', () => {
      it('should NOT allow DRAFT -> ARCHIVED', () => {
        expect(isValidStatusTransition('DRAFT', 'ARCHIVED')).toBe(false);
      });

      it('should NOT allow PUBLISHED -> UNDER_REVIEW', () => {
        expect(isValidStatusTransition('PUBLISHED', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow ARCHIVED -> DRAFT', () => {
        expect(isValidStatusTransition('ARCHIVED', 'DRAFT')).toBe(false);
      });

      it('should NOT allow ARCHIVED -> UNDER_REVIEW', () => {
        expect(isValidStatusTransition('ARCHIVED', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow DRAFT -> DRAFT (self)', () => {
        expect(isValidStatusTransition('DRAFT', 'DRAFT')).toBe(false);
      });

      it('should NOT allow UNDER_REVIEW -> UNDER_REVIEW (self)', () => {
        expect(isValidStatusTransition('UNDER_REVIEW', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow PUBLISHED -> PUBLISHED (self)', () => {
        expect(isValidStatusTransition('PUBLISHED', 'PUBLISHED')).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('should return [UNDER_REVIEW, PUBLISHED] for DRAFT', () => {
      expect(getValidTransitions('DRAFT')).toEqual(['UNDER_REVIEW', 'PUBLISHED']);
    });

    it('should return [DRAFT, PUBLISHED] for UNDER_REVIEW', () => {
      expect(getValidTransitions('UNDER_REVIEW')).toEqual(['DRAFT', 'PUBLISHED']);
    });

    it('should return [DRAFT, ARCHIVED] for PUBLISHED', () => {
      expect(getValidTransitions('PUBLISHED')).toEqual(['DRAFT', 'ARCHIVED']);
    });

    it('should return [PUBLISHED] for ARCHIVED', () => {
      expect(getValidTransitions('ARCHIVED')).toEqual(['PUBLISHED']);
    });
  });

  describe('transitionStatus', () => {
    it('should return new status for valid transition', () => {
      expect(transitionStatus('DRAFT', 'UNDER_REVIEW')).toBe('UNDER_REVIEW');
    });

    it('should throw for invalid transition', () => {
      expect(() => transitionStatus('PUBLISHED', 'UNDER_REVIEW')).toThrow();
    });

    it('should throw for self-transition', () => {
      expect(() => transitionStatus('DRAFT', 'DRAFT')).toThrow();
    });

    it('should return new status for PUBLISHED -> ARCHIVED', () => {
      expect(transitionStatus('PUBLISHED', 'ARCHIVED')).toBe('ARCHIVED');
    });

    it('should throw for ARCHIVED -> DRAFT', () => {
      expect(() => transitionStatus('ARCHIVED', 'DRAFT')).toThrow();
    });
  });
});

describe('Class Entity - Authorization Functions', () => {
  describe('canEditClass', () => {
    // TEACHER role tests
    describe('TEACHER role', () => {
      it('should allow TEACHER to edit DRAFT class', () => {
        expect(canEditClass('TEACHER', 'DRAFT')).toBe(true);
      });

      it('should allow TEACHER to edit UNDER_REVIEW class', () => {
        expect(canEditClass('TEACHER', 'UNDER_REVIEW')).toBe(true);
      });

      it('should NOT allow TEACHER to edit PUBLISHED class', () => {
        expect(canEditClass('TEACHER', 'PUBLISHED')).toBe(false);
      });

      it('should NOT allow TEACHER to edit ARCHIVED class', () => {
        expect(canEditClass('TEACHER', 'ARCHIVED')).toBe(false);
      });
    });

    // ADMIN role tests
    describe('ADMIN role', () => {
      it('should allow ADMIN to edit DRAFT class', () => {
        expect(canEditClass('ADMIN', 'DRAFT')).toBe(true);
      });

      it('should allow ADMIN to edit UNDER_REVIEW class', () => {
        expect(canEditClass('ADMIN', 'UNDER_REVIEW')).toBe(true);
      });

      it('should allow ADMIN to edit PUBLISHED class', () => {
        expect(canEditClass('ADMIN', 'PUBLISHED')).toBe(true);
      });

      it('should allow ADMIN to edit ARCHIVED class', () => {
        expect(canEditClass('ADMIN', 'ARCHIVED')).toBe(true);
      });
    });

    // STUDENT role tests
    describe('STUDENT role', () => {
      it('should NOT allow STUDENT to edit DRAFT class', () => {
        expect(canEditClass('STUDENT', 'DRAFT')).toBe(false);
      });

      it('should NOT allow STUDENT to edit UNDER_REVIEW class', () => {
        expect(canEditClass('STUDENT', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow STUDENT to edit PUBLISHED class', () => {
        expect(canEditClass('STUDENT', 'PUBLISHED')).toBe(false);
      });

      it('should NOT allow STUDENT to edit ARCHIVED class', () => {
        expect(canEditClass('STUDENT', 'ARCHIVED')).toBe(false);
      });
    });
  });

  describe('canPublishClass', () => {
    // TEACHER role tests
    describe('TEACHER role', () => {
      it('should NOT allow TEACHER to publish DRAFT class', () => {
        expect(canPublishClass('TEACHER', 'DRAFT')).toBe(false);
      });

      it('should allow TEACHER to publish UNDER_REVIEW class', () => {
        expect(canPublishClass('TEACHER', 'UNDER_REVIEW')).toBe(true);
      });

      it('should NOT allow TEACHER to publish PUBLISHED class', () => {
        expect(canPublishClass('TEACHER', 'PUBLISHED')).toBe(false);
      });

      it('should NOT allow TEACHER to publish ARCHIVED class', () => {
        expect(canPublishClass('TEACHER', 'ARCHIVED')).toBe(false);
      });
    });

    // ADMIN role tests
    describe('ADMIN role', () => {
      it('should allow ADMIN to publish DRAFT class', () => {
        expect(canPublishClass('ADMIN', 'DRAFT')).toBe(true);
      });

      it('should allow ADMIN to publish UNDER_REVIEW class', () => {
        expect(canPublishClass('ADMIN', 'UNDER_REVIEW')).toBe(true);
      });

      it('should allow ADMIN to publish PUBLISHED class', () => {
        expect(canPublishClass('ADMIN', 'PUBLISHED')).toBe(true);
      });

      it('should allow ADMIN to publish ARCHIVED class', () => {
        expect(canPublishClass('ADMIN', 'ARCHIVED')).toBe(true);
      });
    });

    // STUDENT role tests
    describe('STUDENT role', () => {
      it('should NOT allow STUDENT to publish DRAFT class', () => {
        expect(canPublishClass('STUDENT', 'DRAFT')).toBe(false);
      });

      it('should NOT allow STUDENT to publish UNDER_REVIEW class', () => {
        expect(canPublishClass('STUDENT', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow STUDENT to publish PUBLISHED class', () => {
        expect(canPublishClass('STUDENT', 'PUBLISHED')).toBe(false);
      });

      it('should NOT allow STUDENT to publish ARCHIVED class', () => {
        expect(canPublishClass('STUDENT', 'ARCHIVED')).toBe(false);
      });
    });
  });

  describe('canDeleteClass', () => {
    // TEACHER role tests
    describe('TEACHER role', () => {
      it('should allow TEACHER to delete DRAFT class', () => {
        expect(canDeleteClass('TEACHER', 'DRAFT')).toBe(true);
      });

      it('should NOT allow TEACHER to delete UNDER_REVIEW class', () => {
        expect(canDeleteClass('TEACHER', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow TEACHER to delete PUBLISHED class', () => {
        expect(canDeleteClass('TEACHER', 'PUBLISHED')).toBe(false);
      });

      it('should NOT allow TEACHER to delete ARCHIVED class', () => {
        expect(canDeleteClass('TEACHER', 'ARCHIVED')).toBe(false);
      });
    });

    // ADMIN role tests
    describe('ADMIN role', () => {
      it('should allow ADMIN to delete DRAFT class', () => {
        expect(canDeleteClass('ADMIN', 'DRAFT')).toBe(true);
      });

      it('should allow ADMIN to delete UNDER_REVIEW class', () => {
        expect(canDeleteClass('ADMIN', 'UNDER_REVIEW')).toBe(true);
      });

      it('should allow ADMIN to delete PUBLISHED class', () => {
        expect(canDeleteClass('ADMIN', 'PUBLISHED')).toBe(true);
      });

      it('should allow ADMIN to delete ARCHIVED class', () => {
        expect(canDeleteClass('ADMIN', 'ARCHIVED')).toBe(true);
      });
    });

    // STUDENT role tests
    describe('STUDENT role', () => {
      it('should NOT allow STUDENT to delete DRAFT class', () => {
        expect(canDeleteClass('STUDENT', 'DRAFT')).toBe(false);
      });

      it('should NOT allow STUDENT to delete UNDER_REVIEW class', () => {
        expect(canDeleteClass('STUDENT', 'UNDER_REVIEW')).toBe(false);
      });

      it('should NOT allow STUDENT to delete PUBLISHED class', () => {
        expect(canDeleteClass('STUDENT', 'PUBLISHED')).toBe(false);
      });

      it('should NOT allow STUDENT to delete ARCHIVED class', () => {
        expect(canDeleteClass('STUDENT', 'ARCHIVED')).toBe(false);
      });
    });
  });
});

describe('Class Entity - Factory Functions', () => {
  describe('createClassEntity', () => {
    it('should create class with default DRAFT status', () => {
      const classEntity = createClassEntity({
        id: 'class-1',
        title: 'Test Class',
        tutorId: 'tutor-1',
      });

      expect(classEntity.status).toBe('DRAFT');
      expect(classEntity.version).toBe(0);
      expect(classEntity.lessons).toEqual([]);
    });

    it('should create class with provided values', () => {
      const classEntity = createClassEntity({
        id: 'class-1',
        title: 'Test Class',
        description: 'Test Description',
        tutorId: 'tutor-1',
        classTemplateId: 'template-1',
        status: 'PUBLISHED',
        version: 2,
        lessons: [
          createClassLessonEntity({
            id: 'lesson-1',
            classId: 'class-1',
            order: 0,
            recipeId: 'recipe-1',
          }),
        ],
      });

      expect(classEntity.title).toBe('Test Class');
      expect(classEntity.description).toBe('Test Description');
      expect(classEntity.status).toBe('PUBLISHED');
      expect(classEntity.version).toBe(2);
      expect(classEntity.lessons).toHaveLength(1);
    });

    it('should freeze the entity', () => {
      const classEntity = createClassEntity({
        id: 'class-1',
        title: 'Test Class',
        tutorId: 'tutor-1',
      });

      expect(Object.isFrozen(classEntity)).toBe(true);
    });
  });

  describe('createClassLessonEntity', () => {
    it('should create lesson entity with all fields', () => {
      const lesson = createClassLessonEntity({
        id: 'lesson-1',
        classId: 'class-1',
        recipeId: 'recipe-1',
        order: 0,
      });

      expect(lesson.id).toBe('lesson-1');
      expect(lesson.classId).toBe('class-1');
      expect(lesson.recipeId).toBe('recipe-1');
      expect(lesson.order).toBe(0);
    });

    it('should freeze the lesson entity', () => {
      const lesson = createClassLessonEntity({
        id: 'lesson-1',
        classId: 'class-1',
        recipeId: 'recipe-1',
        order: 0,
      });

      expect(Object.isFrozen(lesson)).toBe(true);
    });
  });

  describe('createClassVersionEntity', () => {
    it('should create version with default PUBLISHED status', () => {
      const version = createClassVersionEntity({
        id: 'version-1',
        classId: 'class-1',
        version: '1.0.0',
        title: 'Test Class',
        slug: 'test-class',
      });

      expect(version.status).toBe('PUBLISHED');
      expect(version.isPublished).toBe(false); // isPublished defaults to false
      expect(version.publishedAt).toBeUndefined(); // publishedAt only set when isPublished is true
    });

    it('should create version with published status when isPublished is true', () => {
      const version = createClassVersionEntity({
        id: 'version-1',
        classId: 'class-1',
        version: '1.0.0',
        title: 'Test Class',
        slug: 'test-class',
        isPublished: true,
      });

      expect(version.status).toBe('PUBLISHED');
      expect(version.isPublished).toBe(true);
      expect(version.publishedAt).toBeDefined();
    });
  });
});
