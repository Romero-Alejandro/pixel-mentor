import { create } from 'zustand';
import { groupApi, type Group, type GroupMember, type GroupClass } from '../services/group.api';

interface GroupsState {
  groups: Group[];
  currentGroup: Group | null;
  members: GroupMember[];
  classes: GroupClass[];
  loading: boolean;
  error: string | null;
  totalGroups: number;
  currentPage: number;

  fetchGroups: (page?: number) => Promise<void>;
  fetchGroup: (groupId: string) => Promise<void>;
  createGroup: (data: { name: string; description?: string }) => Promise<Group>;
  updateGroup: (groupId: string, data: { name?: string; description?: string }) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<void>;

  fetchMembers: (groupId: string) => Promise<void>;
  addMembers: (groupId: string, studentIds: string[]) => Promise<GroupMember[]>;
  removeMember: (groupId: string, studentId: string) => Promise<void>;

  fetchClasses: (groupId: string) => Promise<void>;
  assignClass: (groupId: string, classId: string, order?: number) => Promise<GroupClass>;
  unassignClass: (groupId: string, classId: string) => Promise<void>;
  reorderClasses: (groupId: string, classIds: string[]) => Promise<void>;

  clearCurrentGroup: () => void;
  clearError: () => void;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  currentGroup: null,
  members: [],
  classes: [],
  loading: false,
  error: null,
  totalGroups: 0,
  currentPage: 1,

  fetchGroups: async (page = 1) => {
    set({ loading: true, error: null });
    try {
      const result = await groupApi.getGroups(page);
      set({
        groups: result.groups,
        totalGroups: result.total,
        currentPage: result.page,
        loading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchGroup: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const group = await groupApi.getGroup(groupId);
      set({ currentGroup: group, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createGroup: async (data) => {
    set({ loading: true, error: null });
    try {
      const group = await groupApi.createGroup(data);
      set((state) => ({ groups: [group, ...state.groups], loading: false }));
      return group;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateGroup: async (groupId, data) => {
    set({ loading: true, error: null });
    try {
      const group = await groupApi.updateGroup(groupId, data);
      set((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? group : g)),
        currentGroup: state.currentGroup?.id === groupId ? group : state.currentGroup,
        loading: false,
      }));
      return group;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteGroup: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      await groupApi.deleteGroup(groupId);
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
        currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  fetchMembers: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const members = await groupApi.getMembers(groupId);
      set({ members, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addMembers: async (groupId, studentIds) => {
    set({ loading: true, error: null });
    try {
      const members = await groupApi.addMembers(groupId, studentIds);
      set((state) => ({ members: [...state.members, ...members], loading: false }));
      return members;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  removeMember: async (groupId, studentId) => {
    set({ loading: true, error: null });
    try {
      await groupApi.removeMember(groupId, studentId);
      set((state) => ({
        members: state.members.filter((m) => m.studentId !== studentId),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  fetchClasses: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const classes = await groupApi.getGroupClasses(groupId);
      set({ classes, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  assignClass: async (groupId, classId, order) => {
    set({ loading: true, error: null });
    try {
      const groupClass = await groupApi.assignClass(groupId, { classId, order });
      set((state) => ({ classes: [...state.classes, groupClass], loading: false }));
      return groupClass;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  unassignClass: async (groupId, classId) => {
    set({ loading: true, error: null });
    try {
      await groupApi.unassignClass(groupId, classId);
      set((state) => ({
        classes: state.classes.filter((c) => c.classId !== classId),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  reorderClasses: async (groupId, classIds) => {
    set({ loading: true, error: null });
    try {
      await groupApi.reorderClasses(groupId, classIds);
      const currentClasses = get().classes;
      const reordered = classIds
        .map((id, index) => {
          const cls = currentClasses.find((c) => c.classId === id);
          return cls ? { ...cls, order: index } : null;
        })
        .filter(Boolean) as GroupClass[];
      set({ classes: reordered, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  clearCurrentGroup: () => set({ currentGroup: null, members: [], classes: [] }),
  clearError: () => set({ error: null }),
}));
