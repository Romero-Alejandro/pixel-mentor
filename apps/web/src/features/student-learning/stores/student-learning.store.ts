import { create } from 'zustand';
import {
  studentLearningApi,
  type GroupWithClasses,
  type StudentClass,
} from '../services/student-learning.api';

interface StudentLearningState {
  groups: GroupWithClasses[];
  accessibleContent: StudentClass[];
  loading: boolean;
  error: string | null;
  fetchMyGroups: () => Promise<void>;
  fetchAccessibleContent: () => Promise<void>;
  clearError: () => void;
}

export const useStudentLearningStore = create<StudentLearningState>((set) => ({
  groups: [],
  accessibleContent: [],
  loading: false,
  error: null,

  fetchMyGroups: async () => {
    set({ loading: true, error: null });
    try {
      const groups = await studentLearningApi.getMyGroups();
      set({ groups, loading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error de conexión al cargar tus grupos';
      set({ error: errorMessage, loading: false });
    }
  },

  fetchAccessibleContent: async () => {
    set({ loading: true, error: null });
    try {
      const content = await studentLearningApi.getAccessibleContent();
      set({ accessibleContent: content, loading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'No pudimos cargar tus misiones en este momento';
      set({ error: errorMessage, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
