import {
  useQuery,
  useMutation,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  api,
  type Lesson,
  type StartLessonResponse,
  type InteractLessonResponse,
} from '../services/api';

export const lessonKeys = {
  all: ['lessons'] as const,
  lists: () => [...lessonKeys.all, 'list'] as const,
  sessions: (id?: string) => ['sessions', id] as const,
};

export function useLessons(activeOnly = true): UseQueryResult<Lesson[]> {
  return useQuery({
    queryKey: [...lessonKeys.lists(), activeOnly],
    queryFn: () => api.listLessons(activeOnly),
  });
}

export function useStartLesson(): UseMutationResult<StartLessonResponse, Error, string> {
  return useMutation({
    mutationFn: (lessonId: string) => api.startLesson(lessonId),
  });
}

export function useLessonInteraction(): UseMutationResult<
  InteractLessonResponse,
  Error,
  { sessionId: string; input: string }
> {
  return useMutation({
    mutationFn: ({ sessionId, input }) => api.interactWithLesson(sessionId, input),
  });
}
