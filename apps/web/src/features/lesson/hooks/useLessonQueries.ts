import {
  useQuery,
  useMutation,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { type Recipe, type InteractRecipeOutput } from '@pixel-mentor/shared';

import { api } from '../../../services/api';

export const lessonKeys = {
  all: ['recipes'] as const,
  lists: () => [...lessonKeys.all, 'list'] as const,
  sessions: (id?: string) => ['sessions', id] as const,
};

export function useRecipes(activeOnly = true): UseQueryResult<Recipe[]> {
  return useQuery({
    queryKey: [...lessonKeys.lists(), activeOnly],
    queryFn: () => api.listRecipes(activeOnly),
  });
}

// Alias for backwards compatibility
export const useLessons = useRecipes;

export function useStartRecipeDemo(): UseMutationResult<
  {
    sessionId: string;
    pedagogicalState: any;
    voiceText?: string;
    meta?: { config: any };
    isRepeat: boolean;
    lessonProgress?: { currentStep: number; totalSteps: number };
    contentSteps?: any[];
    recipeId: string;
  },
  Error,
  string
> {
  return useMutation({
    mutationFn: (recipeId: string) => api.startRecipeDemo(recipeId),
  });
}

// Alias for backwards compatibility
export const useStartLesson = useStartRecipeDemo;

export function useRecipeInteraction(): UseMutationResult<
  InteractRecipeOutput,
  Error,
  { sessionId: string; input: string }
> {
  return useMutation({
    mutationFn: ({ sessionId, input }) => api.interactWithRecipe(sessionId, input),
  });
}

// Alias for backwards compatibility
export const useLessonInteraction = useRecipeInteraction;
