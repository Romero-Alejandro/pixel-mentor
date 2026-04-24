import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Class,
  ClassCreate,
  ClassUpdate,
  ClassPublish,
  ClassTemplate,
  ClassTemplateCreate,
  GenerateClassDraftInput,
  GenerateClassDraftOutput,
} from '@pixel-mentor/shared';

import { api } from '@/services/api';

interface ClassState {
  // State
  classes: Class[];
  currentClass: Class | null;
  templates: ClassTemplate[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchClasses: (status?: string) => Promise<void>;
  fetchClass: (classId: string) => Promise<void>;
  createClass: (data: ClassCreate) => Promise<Class>;
  updateClass: (classId: string, data: ClassUpdate) => Promise<Class>;
  deleteClass: (classId: string) => Promise<void>;
  publishClass: (classId: string, data?: ClassPublish) => Promise<Class>;
  unpublishClass: (classId: string) => Promise<Class>;
  setCurrentClass: (classItem: Class | null) => void;

  // Lesson actions
  addLesson: (classId: string, lesson: { recipeId: string; order?: number }) => Promise<void>;
  removeLesson: (classId: string, lessonId: string) => Promise<void>;
  updateLesson: (
    classId: string,
    lessonId: string,
    data: Partial<{ recipeId: string; order: number }>,
  ) => Promise<void>;
  reorderLessons: (classId: string, lessonIds: string[]) => Promise<void>;

  // Template actions
  fetchTemplates: () => Promise<void>;
  createTemplate: (data: ClassTemplateCreate) => Promise<ClassTemplate>;
  createClassFromTemplate: (templateId: string, title: string) => Promise<Class>;

  // AI Generation
  generateClassDraft: (input: GenerateClassDraftInput) => Promise<GenerateClassDraftOutput>;

  // Error handling
  clearError: () => void;
}

export const useClassStore = create<ClassState>()(
  persist(
    (set, _get) => ({
      classes: [],
      currentClass: null,
      templates: [],
      isLoading: false,
      error: null,

      fetchClasses: async (status?: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.listClasses(status);
          set({ classes: result.classes, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch classes';
          set({ error: message, isLoading: false });
        }
      },

      fetchClass: async (classId: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.getClass(classId);
          console.log('[DEBUG] Clase cargada:', result);
          console.log('[DEBUG] Lessons:', result.lessons);
          set({ currentClass: result, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch class';
          set({ error: message, isLoading: false });
        }
      },

      createClass: async (data: ClassCreate) => {
        set({ isLoading: true, error: null });
        try {
          const newClass = await api.createClass(data);
          set((state) => ({
            classes: [newClass, ...state.classes],
            currentClass: newClass,
            isLoading: false,
          }));
          return newClass;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create class';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      updateClass: async (classId: string, data: ClassUpdate) => {
        set({ isLoading: true, error: null });
        try {
          const updatedClass = await api.updateClass(classId, data);
          set((state) => ({
            classes: state.classes.map((c) => (c.id === classId ? updatedClass : c)),
            currentClass: state.currentClass?.id === classId ? updatedClass : state.currentClass,
            isLoading: false,
          }));
          return updatedClass;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update class';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      deleteClass: async (classId: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.deleteClass(classId);
          set((state) => ({
            classes: state.classes.filter((c) => c.id !== classId),
            currentClass: state.currentClass?.id === classId ? null : state.currentClass,
            isLoading: false,
          }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete class';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      publishClass: async (classId: string, data?: ClassPublish) => {
        set({ isLoading: true, error: null });
        try {
          const publishedClass = await api.publishClass(classId, data);
          set((state) => ({
            classes: state.classes.map((c) => (c.id === classId ? publishedClass : c)),
            currentClass: state.currentClass?.id === classId ? publishedClass : state.currentClass,
            isLoading: false,
          }));
          return publishedClass;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to publish class';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      unpublishClass: async (classId: string) => {
        set({ isLoading: true, error: null });
        try {
          const unpublishedClass = await api.unpublishClass(classId);
          set((state) => ({
            classes: state.classes.map((c) => (c.id === classId ? unpublishedClass : c)),
            currentClass:
              state.currentClass?.id === classId ? unpublishedClass : state.currentClass,
            isLoading: false,
          }));
          return unpublishedClass;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to unpublish class';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      setCurrentClass: (classItem) => set({ currentClass: classItem }),

      addLesson: async (classId: string, lesson) => {
        set({ isLoading: true, error: null });
        try {
          const newLesson = await api.addClassLesson(classId, lesson);
          set((state) => {
            if (!state.currentClass || state.currentClass.id !== classId) {
              return { isLoading: false };
            }
            const currentLessons = state.currentClass.lessons || [];
            const updatedClass: Class = {
              ...state.currentClass,
              lessons: [...currentLessons, newLesson],
            };
            return {
              classes: state.classes.map((c) => (c.id === classId ? updatedClass : c)),
              currentClass: updatedClass,
              isLoading: false,
            };
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to add lesson';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      removeLesson: async (classId: string, lessonId: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.removeClassLesson(classId, lessonId);
          set((state) => {
            if (!state.currentClass || state.currentClass.id !== classId) {
              return { isLoading: false };
            }
            const currentLessons = state.currentClass.lessons || [];
            const updatedClass: Class = {
              ...state.currentClass,
              lessons: currentLessons.filter((l) => l.id !== lessonId),
            };
            return {
              classes: state.classes.map((c) => (c.id === classId ? updatedClass : c)),
              currentClass: updatedClass,
              isLoading: false,
            };
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to remove lesson';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      updateLesson: async (classId: string, lessonId: string, data) => {
        set({ isLoading: true, error: null });
        try {
          const updatedLesson = await api.updateClassLesson(classId, lessonId, data);
          set((state) => {
            if (!state.currentClass || state.currentClass.id !== classId) {
              return { isLoading: false };
            }
            const currentLessons = state.currentClass.lessons || [];
            const updatedLessons = currentLessons.map((l) =>
              l.id === lessonId ? updatedLesson : l,
            );
            const updatedClass: Class = {
              ...state.currentClass,
              lessons: updatedLessons,
            };
            return {
              classes: state.classes.map((c) => (c.id === classId ? updatedClass : c)),
              currentClass: updatedClass,
              isLoading: false,
            };
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update lesson';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      reorderLessons: async (classId: string, lessonIds: string[]) => {
        set({ isLoading: true, error: null });
        try {
          await api.reorderClassLessons(classId, lessonIds);
          set((state) => {
            if (!state.currentClass || state.currentClass.id !== classId) {
              return { isLoading: false };
            }
            const currentLessons = state.currentClass.lessons || [];
            // Reorder lessons based on lessonIds array
            const reorderedLessons = lessonIds
              .map((id) => currentLessons.find((l) => l.id === id))
              .filter((l): l is NonNullable<typeof l> => l !== undefined);
            const updatedClass: Class = {
              ...state.currentClass,
              lessons: reorderedLessons,
            };
            return {
              classes: state.classes.map((c) => (c.id === classId ? updatedClass : c)),
              currentClass: updatedClass,
              isLoading: false,
            };
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to reorder lessons';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      fetchTemplates: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.listClassTemplates();
          set({ templates: result, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch templates';
          set({ error: message, isLoading: false });
        }
      },

      createTemplate: async (data: ClassTemplateCreate) => {
        set({ isLoading: true, error: null });
        try {
          const newTemplate = await api.createClassTemplate(data);
          set((state) => ({
            templates: [newTemplate, ...state.templates],
            isLoading: false,
          }));
          return newTemplate;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create template';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      createClassFromTemplate: async (templateId: string, title: string) => {
        set({ isLoading: true, error: null });
        try {
          const newClass = await api.createClassFromTemplate(templateId, title);
          set((state) => ({
            classes: [newClass, ...state.classes],
            isLoading: false,
          }));
          return newClass;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to create class from template';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      generateClassDraft: async (input: GenerateClassDraftInput) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.generateClassDraft(input);
          set({ isLoading: false });
          return result;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to generate class draft';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'class-storage',
      partialize: (state) => ({
        classes: state.classes,
        templates: state.templates,
      }),
    },
  ),
);
