import { describe, it, expect, beforeEach } from 'vitest';

import { useLessonStore } from '../../stores/lessonStore';

describe('lessonStore', () => {
  beforeEach(() => {
    useLessonStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useLessonStore.getState();
      expect(state.lessonId).toBeNull();
      expect(state.currentState).toBe('ACTIVE_CLASS');
      expect(state.isListening).toBe(false);
      expect(state.isSpeaking).toBe(false);
    });
  });

  describe('setLessonId', () => {
    it('should set the lesson ID', () => {
      useLessonStore.getState().setLessonId('lesson-123');
      expect(useLessonStore.getState().lessonId).toBe('lesson-123');
    });
  });

  describe('setCurrentState', () => {
    it('should set the current pedagogical state', () => {
      useLessonStore.getState().setCurrentState('RESOLVING_DOUBT');
      expect(useLessonStore.getState().currentState).toBe('RESOLVING_DOUBT');
    });
  });

  describe('setIsListening', () => {
    it('should set listening state to true', () => {
      useLessonStore.getState().setIsListening(true);
      expect(useLessonStore.getState().isListening).toBe(true);
    });

    it('should set listening state to false', () => {
      useLessonStore.getState().setIsListening(true);
      useLessonStore.getState().setIsListening(false);
      expect(useLessonStore.getState().isListening).toBe(false);
    });
  });

  describe('setIsSpeaking', () => {
    it('should set speaking state to true', () => {
      useLessonStore.getState().setIsSpeaking(true);
      expect(useLessonStore.getState().isSpeaking).toBe(true);
    });

    it('should set speaking state to false', () => {
      useLessonStore.getState().setIsSpeaking(true);
      useLessonStore.getState().setIsSpeaking(false);
      expect(useLessonStore.getState().isSpeaking).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      useLessonStore.getState().setLessonId('lesson-123');
      useLessonStore.getState().setCurrentState('RESOLVING_DOUBT');
      useLessonStore.getState().setIsListening(true);
      useLessonStore.getState().setIsSpeaking(true);

      useLessonStore.getState().reset();

      const state = useLessonStore.getState();
      expect(state.lessonId).toBeNull();
      expect(state.currentState).toBe('ACTIVE_CLASS');
      expect(state.isListening).toBe(false);
      expect(state.isSpeaking).toBe(false);
    });
  });
});
