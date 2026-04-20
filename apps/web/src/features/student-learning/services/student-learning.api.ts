import { apiClient } from '@/services/api-client';
import type { Group } from '../../group/services/group.api';

export interface GroupWithClasses extends Group {
  classes: StudentClass[];
}

export interface StudentClass {
  classId: string;
  classTitle: string;
  groupId: string;
  groupName: string;
  order: number;
  status: string;
}

export const studentLearningApi = {
  getMyGroups: async (): Promise<GroupWithClasses[]> => {
    const response = await apiClient.get<GroupWithClasses[]>('/api/groups');
    return response.data;
  },

  getAccessibleContent: async (): Promise<StudentClass[]> => {
    const response = await apiClient.get<StudentClass[]>('/api/content/accessible');
    return response.data;
  },
};
