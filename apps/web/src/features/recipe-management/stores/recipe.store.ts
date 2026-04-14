import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Recipe, RecipeStep } from '@pixel-mentor/shared';

import { api } from '@/services/api';

interface RecipeState {
  // State
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRecipes: (options?: { status?: 'my' | 'published' }) => Promise<void>;
  fetchRecipe: (recipeId: string) => Promise<void>;
  createRecipe: (data: {
    title: string;
    description?: string;
    expectedDurationMinutes?: number;
    moduleId?: string;
    published?: boolean;
    steps?: Array<{
      atomId?: string;
      order?: number;
      conceptId?: string;
      activityId?: string;
      stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
      script?: Record<string, unknown>;
      activity?: Record<string, unknown>;
      question?: Record<string, unknown>;
    }>;
  }) => Promise<Recipe>;
  updateRecipe: (
    recipeId: string,
    data: {
      title?: string;
      description?: string;
      expectedDurationMinutes?: number;
      moduleId?: string;
      published?: boolean;
    },
  ) => Promise<Recipe>;
  deleteRecipe: (recipeId: string) => Promise<void>;

  // Step actions
  addStep: (
    recipeId: string,
    step: {
      atomId?: string;
      order?: number;
      conceptId?: string;
      activityId?: string;
      stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
      script?: Record<string, unknown>;
      activity?: Record<string, unknown>;
      question?: Record<string, unknown>;
    },
  ) => Promise<RecipeStep>;
  updateStep: (
    recipeId: string,
    stepId: string,
    step: {
      atomId?: string;
      order?: number;
      conceptId?: string;
      activityId?: string;
      stepType?: 'content' | 'activity' | 'question' | 'intro' | 'closure';
      script?: Record<string, unknown>;
      activity?: Record<string, unknown>;
      question?: Record<string, unknown>;
    },
  ) => Promise<RecipeStep>;
  deleteStep: (recipeId: string, stepId: string) => Promise<void>;
  reorderSteps: (recipeId: string, stepIds: string[]) => Promise<void>;

  // Utility
  setCurrentRecipe: (recipe: Recipe | null) => void;
  clearError: () => void;
}

import { RecipeSchema } from '@pixel-mentor/shared';

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, _get) => ({
      recipes: [],
      currentRecipe: null,
      isLoading: false,
      error: null,

      fetchRecipes: async (options) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.listAllRecipes(options);
          set({ recipes: result, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch recipes';
          set({ error: message, isLoading: false });
        }
      },

      fetchRecipe: async (recipeId: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await api.getRecipe(recipeId);
          set({ currentRecipe: result, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to fetch recipe';
          set({ error: message, isLoading: false });
        }
      },

      createRecipe: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const newRecipe = await api.createRecipe(data);
          set((state) => ({
            recipes: [newRecipe, ...state.recipes],
            currentRecipe: newRecipe,
            isLoading: false,
          }));
          return newRecipe;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create recipe';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      updateRecipe: async (recipeId, data) => {
        set({ isLoading: true, error: null });
        try {
          const updatedRecipe = await api.updateRecipe(recipeId, data);
          set((state) => ({
            recipes: state.recipes.map((r) => (r.id === recipeId ? updatedRecipe : r)),
            currentRecipe:
              state.currentRecipe?.id === recipeId ? updatedRecipe : state.currentRecipe,
            isLoading: false,
          }));
          return updatedRecipe;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update recipe';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      deleteRecipe: async (recipeId: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.deleteRecipe(recipeId);
          set((state) => ({
            recipes: state.recipes.filter((r) => r.id !== recipeId),
            currentRecipe: state.currentRecipe?.id === recipeId ? null : state.currentRecipe,
            isLoading: false,
          }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete recipe';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      addStep: async (recipeId, step) => {
        set({ isLoading: true, error: null });
        try {
          const newStep = await api.addStep(recipeId, step);
          set((state) => {
            // Update steps in recipes list
            const updatedRecipes = state.recipes.map((r) => {
              if (r.id === recipeId) {
                const currentSteps = r.steps || [];
                return { ...r, steps: [...currentSteps, newStep] };
              }
              return r;
            });
            // Update currentRecipe if it matches
            let updatedCurrent = state.currentRecipe;
            if (state.currentRecipe && state.currentRecipe.id === recipeId) {
              const currentSteps = state.currentRecipe.steps || [];
              updatedCurrent = { ...state.currentRecipe, steps: [...currentSteps, newStep] };
            }
            return {
              recipes: updatedRecipes,
              currentRecipe: updatedCurrent,
              isLoading: false,
            };
          });
          return newStep;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to add step';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      updateStep: async (recipeId, stepId, step) => {
        set({ isLoading: true, error: null });
        try {
          const updatedStep = await api.updateStep(recipeId, stepId, step);
          set((state) => {
            // Update step in recipes list
            const updatedRecipes = state.recipes.map((r) => {
              if (r.id === recipeId && r.steps) {
                const updatedSteps = r.steps.map((s) => (s.id === stepId ? updatedStep : s));
                return { ...r, steps: updatedSteps };
              }
              return r;
            });
            // Update currentRecipe if it matches
            let updatedCurrent = state.currentRecipe;
            if (
              state.currentRecipe &&
              state.currentRecipe.id === recipeId &&
              state.currentRecipe.steps
            ) {
              const updatedSteps = state.currentRecipe.steps.map((s) =>
                s.id === stepId ? updatedStep : s,
              );
              updatedCurrent = { ...state.currentRecipe, steps: updatedSteps };
            }
            return {
              recipes: updatedRecipes,
              currentRecipe: updatedCurrent,
              isLoading: false,
            };
          });
          return updatedStep;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update step';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      deleteStep: async (recipeId, stepId) => {
        set({ isLoading: true, error: null });
        try {
          await api.deleteStep(recipeId, stepId);
          set((state) => {
            // Remove step from recipes list
            const updatedRecipes = state.recipes.map((r) => {
              if (r.id === recipeId && r.steps) {
                const filteredSteps = r.steps.filter((s) => s.id !== stepId);
                return { ...r, steps: filteredSteps };
              }
              return r;
            });
            // Update currentRecipe if it matches
            let updatedCurrent = state.currentRecipe;
            if (
              state.currentRecipe &&
              state.currentRecipe.id === recipeId &&
              state.currentRecipe.steps
            ) {
              const filteredSteps = state.currentRecipe.steps.filter((s) => s.id !== stepId);
              updatedCurrent = { ...state.currentRecipe, steps: filteredSteps };
            }
            return {
              recipes: updatedRecipes,
              currentRecipe: updatedCurrent,
              isLoading: false,
            };
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to delete step';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      reorderSteps: async (recipeId, stepIds) => {
        set({ isLoading: true, error: null });
        try {
          await api.reorderSteps(recipeId, stepIds);
          set((state) => {
            // Reorder steps in recipes list
            const updatedRecipes = state.recipes.map((r) => {
              if (r.id === recipeId && r.steps) {
                // Create a map for quick lookup
                const stepMap = new Map(r.steps.map((s) => [s.id, s]));
                // Reorder based on stepIds array
                const reorderedSteps = stepIds
                  .map((id) => stepMap.get(id))
                  .filter((s): s is NonNullable<typeof s> => s !== undefined);
                return { ...r, steps: reorderedSteps };
              }
              return r;
            });
            // Update currentRecipe if it matches
            let updatedCurrent = state.currentRecipe;
            if (
              state.currentRecipe &&
              state.currentRecipe.id === recipeId &&
              state.currentRecipe.steps
            ) {
              const stepMap = new Map(state.currentRecipe.steps.map((s) => [s.id, s]));
              const reorderedSteps = stepIds
                .map((id) => stepMap.get(id))
                .filter((s): s is NonNullable<typeof s> => s !== undefined);
              updatedCurrent = { ...state.currentRecipe, steps: reorderedSteps };
            }
            return {
              recipes: updatedRecipes,
              currentRecipe: updatedCurrent,
              isLoading: false,
            };
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to reorder steps';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      setCurrentRecipe: (recipe) => set({ currentRecipe: recipe }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'recipe-storage',
      partialize: (state) => ({
        recipes: state.recipes,
        currentRecipe: state.currentRecipe,
      }),
    },
  ),
);
