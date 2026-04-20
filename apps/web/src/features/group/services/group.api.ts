import { apiClient } from '@/services/api-client';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  studentId: string;
  status: string;
  user?: { name: string; email: string };
}

export interface GroupClass {
  id: string;
  classId: string;
  order: number;
  class?: { id: string; title: string; status: string };
}

export interface GroupWithCounts extends Group {
  _count?: { memberships: number; classAssignments: number };
}

export interface ContentAccess {
  classId: string;
  classTitle: string;
  groupId: string;
  groupName: string;
  order: number;
  status: string;
}

export const userApi = {
  resolveEmailToUuid: async (email: string): Promise<{ uuid: string }> => {
    const response = await apiClient.get<{ uuid: string }>('/api/auth/users/resolve', {
      params: { email },
    });
    return response.data;
  },
};

export const groupApi = {
  createGroup: async (data: { name: string; description?: string }): Promise<Group> => {
    const response = await apiClient.post<Group>('/api/groups', data);
    return response.data;
  },

  getGroups: async (
    page = 1,
    limit = 20,
  ): Promise<{ groups: Group[]; total: number; page: number; limit: number }> => {
    const response = await apiClient.get('/api/groups', { params: { page, limit } });
    return response.data;
  },

  getGroup: async (groupId: string): Promise<Group> => {
    const response = await apiClient.get<Group>(`/api/groups/${groupId}`);
    return response.data;
  },

  updateGroup: async (
    groupId: string,
    data: { name?: string; description?: string },
  ): Promise<Group> => {
    const response = await apiClient.put<Group>(`/api/groups/${groupId}`, data);
    return response.data;
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    await apiClient.delete(`/api/groups/${groupId}`);
  },

  addMembers: async (groupId: string, studentIds: string[]): Promise<GroupMember[]> => {
    const response = await apiClient.post<GroupMember[]>(`/api/groups/${groupId}/members`, {
      studentIds,
    });
    return response.data;
  },

  getMembers: async (groupId: string): Promise<GroupMember[]> => {
    const response = await apiClient.get<GroupMember[]>(`/api/groups/${groupId}/members`);
    return response.data;
  },

  removeMember: async (groupId: string, studentId: string): Promise<void> => {
    await apiClient.delete(`/api/groups/${groupId}/members/${studentId}`);
  },

  assignClass: async (
    groupId: string,
    data: { classId: string; order?: number },
  ): Promise<GroupClass> => {
    const response = await apiClient.post<GroupClass>(`/api/groups/${groupId}/classes`, data);
    return response.data;
  },

  getGroupClasses: async (groupId: string): Promise<GroupClass[]> => {
    const response = await apiClient.get<GroupClass[]>(`/api/groups/${groupId}/classes`);
    return response.data;
  },

  unassignClass: async (groupId: string, classId: string): Promise<void> => {
    await apiClient.delete(`/api/groups/${groupId}/classes/${classId}`);
  },

  reorderClasses: async (groupId: string, classIds: string[]): Promise<void> => {
    await apiClient.patch(`/api/groups/${groupId}/classes/reorder`, { classIds });
  },
};

export const contentApi = {
  getAccessibleContent: async (): Promise<ContentAccess[]> => {
    const response = await apiClient.get<ContentAccess[]>('/api/content/accessible');
    return response.data;
  },

  canAccessClass: async (classId: string): Promise<{ canAccess: boolean }> => {
    const response = await apiClient.get<{ canAccess: boolean }>(
      `/api/content/accessible/can-access/${classId}`,
    );
    return response.data;
  },
};
