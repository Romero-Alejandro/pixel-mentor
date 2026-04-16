import {
  useQuery,
  useMutation,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  type Recipe,
  type StartRecipeOutput,
  type InteractRecipeOutput,
} from '@pixel-mentor/shared';

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

export function useStartClassDemo(): UseMutationResult<
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
    mutationFn: (classId: string) => api.startClassDemo(classId),
  });
}

// Alias for backwards compatibility
export const useStartLesson = useStartClassDemo;

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
